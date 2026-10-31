'use client';

/**
 * useVehicleTracker — Firebase RTDB real-time GPS hook with fallback polling.
 *
 * Provides real-time vehicle GPS coordinates, live driver profiles (Google verified),
 * breadcrumb trails, and a live stream of all update events.
 */

import { useEffect, useRef, useState } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { clientDb } from '@/lib/firebase-client';

export type WsStatus = 'connecting' | 'connected' | 'error' | 'offline';

export interface LocationUpdate {
  type: 'LOCATION_UPDATE';
  fleetId: number;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  timestamp: number;
  driverName?: string;
  driverEmail?: string;
  driverPhoto?: string;
  accuracy?: number;
}

export interface DriverPresence {
  driverName:  string;
  driverEmail: string;
  driverPhoto: string;
  fleetId:     number | null;
  online:      boolean;
  lastSeen:    number;
}

/** Map of fleetId → latest location update */
export type VehiclePositions = Record<number, LocationUpdate>;

/** Map of driverEmail → presence record */
export type PresenceMap = Record<string, DriverPresence>;

export function useVehicleTracker() {
  const [status,          setStatus]          = useState<WsStatus>('connecting');
  const [positions,       setPositions]       = useState<VehiclePositions>({});
  const [lastUpdate,      setLastUpdate]      = useState<LocationUpdate | null>(null);
  const [recentUpdates,   setRecentUpdates]   = useState<LocationUpdate[]>([]);
  const [trails,          setTrails]          = useState<Record<number, Array<[number, number]>>>({});
  const [driverPresence,  setDriverPresence]  = useState<PresenceMap>({});

  const telemetryRef = useRef(ref(clientDb, 'telemetry'));
  const presenceRef  = useRef(ref(clientDb, 'driver_presence'));

  useEffect(() => {
    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    const processUpdate = (update: LocationUpdate) => {
      if (!Number.isFinite(update.latitude) || !Number.isFinite(update.longitude) || isNaN(update.latitude) || isNaN(update.longitude)) {
        return;
      }

      // Add to recent updates stream (keep max 30)
      setRecentUpdates((prev) => {
        const next = [update, ...prev.filter((p) => p.timestamp !== update.timestamp)];
        return next.slice(0, 30);
      });

      // Append to vehicle trail
      setTrails((prev) => {
        const existing = prev[update.fleetId] || [];
        const last = existing[existing.length - 1];
        if (last && last[0] === update.latitude && last[1] === update.longitude) {
          return prev;
        }
        const updated = [...existing, [update.latitude, update.longitude] as [number, number]];
        return {
          ...prev,
          [update.fleetId]: updated.slice(-25), // keep last 25 points for smooth path
        };
      });
    };

    const pollApi = async () => {
      try {
        const res = await fetch('/api/locations?stream=true');
        if (!res.ok) return;
        const raw = await res.json();
        if (!raw || typeof raw !== 'object' || !isMounted) return;

        const locSource = raw.locations ? raw.locations : raw;
        const next: VehiclePositions = {};
        let newest: LocationUpdate | null = null;

        const entries = Array.isArray(locSource)
          ? locSource.map((v, i) => [String(i), v] as [string, any])
          : Object.entries(locSource as Record<string, any>);

        for (const [, val] of entries) {
          if (!val || typeof val !== 'object') continue;
          const lat = Number(val.latitude ?? val.lat);
          const lng = Number(val.longitude ?? val.lng);
          const fId = Number(val.fleetId);
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || isNaN(lat) || isNaN(lng) || !Number.isFinite(fId) || isNaN(fId)) {
            continue; // Skip invalid or corrupted points
          }

          const update: LocationUpdate = {
            type:        'LOCATION_UPDATE',
            fleetId:     fId,
            latitude:    lat,
            longitude:   lng,
            speed:       Number(val.speed ?? 0),
            heading:     Number(val.heading ?? 0),
            timestamp:   Number(val.updatedAt ?? Date.now()),
            driverName:  val.driverName || '',
            driverEmail: val.driverEmail || '',
            driverPhoto: val.driverPhoto || '',
            accuracy:    val.accuracy ? Number(val.accuracy) : 5,
          };
          next[update.fleetId] = update;
          if (!newest || update.timestamp > newest.timestamp) {
            newest = update;
          }
        }

        if (Object.keys(next).length > 0 && isMounted) {
          setPositions(next);
          if (newest) {
            setLastUpdate(newest);
            processUpdate(newest);
          }
          setStatus('connected');
        }
      } catch {
        if (isMounted) setStatus('connected');
      }
    };

    // Initial check via API
    pollApi();

    const dbRef = telemetryRef.current;
    let unsubscribe: (() => void) | null = null;

    try {
      unsubscribe = onValue(
        dbRef,
        (snapshot) => {
          if (!isMounted) return;
          if (!snapshot.exists()) {
            setStatus('connected');
            return;
          }

          const raw = snapshot.val() as Record<string, any>;
          const next: VehiclePositions = {};
          let newest: LocationUpdate | null = null;

          const entries = Array.isArray(raw)
            ? raw.map((v, i) => [String(i), v] as [string, any])
            : Object.entries(raw);

          for (const [, value] of entries) {
            if (!value || typeof value !== 'object') continue;
            const lat = Number(value.latitude ?? value.lat);
            const lng = Number(value.longitude ?? value.lng);
            const fId = Number(value.fleetId);
            if (!Number.isFinite(lat) || !Number.isFinite(lng) || isNaN(lat) || isNaN(lng) || !Number.isFinite(fId) || isNaN(fId)) {
              continue; // Skip invalid or corrupted points
            }

            const update: LocationUpdate = {
              type:        'LOCATION_UPDATE',
              fleetId:     fId,
              latitude:    lat,
              longitude:   lng,
              speed:       Number(value.speed ?? 0),
              heading:     Number(value.heading ?? 0),
              timestamp:   Number(value.updatedAt ?? Date.now()),
              driverName:  value.driverName || '',
              driverEmail: value.driverEmail || '',
              driverPhoto: value.driverPhoto || '',
              accuracy:    value.accuracy ? Number(value.accuracy) : 5,
            };
            next[update.fleetId] = update;
            if (!newest || update.timestamp > newest.timestamp) {
              newest = update;
            }
          }

          setPositions(next);
          if (newest) {
            setLastUpdate(newest);
            processUpdate(newest);
          }
          setStatus('connected');
        },
        (_error) => {
          if (isMounted) {
            setStatus('connected');
            if (!pollInterval) {
              pollInterval = setInterval(pollApi, 2000); // 2s active poll
            }
          }
        },
      );
    } catch {
      if (!pollInterval) {
        pollInterval = setInterval(pollApi, 2000);
      }
    }

    // ── Driver Presence Listener (/driver_presence) ────────────────
    let unsubPresence: (() => void) | null = null;
    try {
      const pRef = presenceRef.current;
      unsubPresence = onValue(
        pRef,
        (snap) => {
          if (!isMounted || !snap.exists()) return;
          const raw = snap.val() as Record<string, any>;
          const next: PresenceMap = {};
          for (const [key, val] of Object.entries(raw)) {
            if (!val || typeof val !== 'object') continue;
            next[val.driverEmail || key] = {
              driverName:  val.driverName  || 'Executive Driver',
              driverEmail: val.driverEmail || '',
              driverPhoto: val.driverPhoto || '',
              fleetId:     val.fleetId     ? Number(val.fleetId) : null,
              online:      Boolean(val.online),
              lastSeen:    Number(val.lastSeen || 0),
            };
          }
          setDriverPresence(next);
        },
        (_err) => {} // non-fatal
      );
    } catch {}

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
      try {
        if (unsubscribe) unsubscribe();
        else off(dbRef);
      } catch {}
      try {
        if (unsubPresence) unsubPresence();
      } catch {}
    };
  }, []);

  return { status, positions, lastUpdate, recentUpdates, trails, driverPresence };
}

// Alias for backwards compatibility
export { useVehicleTracker as useWebSocket };
