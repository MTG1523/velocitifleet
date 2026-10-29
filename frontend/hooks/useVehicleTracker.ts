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

/** Map of fleetId → latest location update */
export type VehiclePositions = Record<number, LocationUpdate>;

export function useVehicleTracker() {
  const [status,        setStatus]        = useState<WsStatus>('connecting');
  const [positions,     setPositions]     = useState<VehiclePositions>({});
  const [lastUpdate,    setLastUpdate]    = useState<LocationUpdate | null>(null);
  const [recentUpdates, setRecentUpdates] = useState<LocationUpdate[]>([]);
  const [trails,        setTrails]        = useState<Record<number, Array<[number, number]>>>({});

  const telemetryRef = useRef(ref(clientDb, 'telemetry'));

  useEffect(() => {
    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    const processUpdate = (update: LocationUpdate) => {
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

        for (const [, val] of Object.entries(locSource as Record<string, any>)) {
          if (!val || typeof val !== 'object') continue;
          const update: LocationUpdate = {
            type:        'LOCATION_UPDATE',
            fleetId:     Number(val.fleetId),
            latitude:    Number(val.latitude),
            longitude:   Number(val.longitude),
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

          for (const [, value] of Object.entries(raw)) {
            if (!value || typeof value !== 'object') continue;
            const update: LocationUpdate = {
              type:        'LOCATION_UPDATE',
              fleetId:     Number(value.fleetId),
              latitude:    Number(value.latitude),
              longitude:   Number(value.longitude),
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

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
      try {
        if (unsubscribe) unsubscribe();
        else off(dbRef);
      } catch {}
    };
  }, []);

  return { status, positions, lastUpdate, recentUpdates, trails };
}

// Alias for backwards compatibility
export { useVehicleTracker as useWebSocket };
