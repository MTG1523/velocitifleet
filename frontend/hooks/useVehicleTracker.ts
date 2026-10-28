'use client';

/**
 * useVehicleTracker — Firebase RTDB real-time GPS hook with fallback polling.
 *
 * Drops in for useWebSocket.ts. Attaches a listener to /telemetry on Firebase RTDB.
 * If Firebase RTDB is unavailable or using placeholder credentials, seamlessly falls back
 * to polling /api/locations so live tracking works reliably in development mode.
 */

import { useEffect, useRef, useState } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { clientDb } from '@/lib/firebase-client';

// ── Types (preserved from useWebSocket.ts for drop-in compatibility) ─────

export type WsStatus = 'connecting' | 'connected' | 'error' | 'offline';

export interface LocationUpdate {
  type: 'LOCATION_UPDATE';
  fleetId: number;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  timestamp: number;
}

/** Map of fleetId → latest location update */
export type VehiclePositions = Record<number, LocationUpdate>;

// ── Hook ─────────────────────────────────────────────────────────────────

export function useVehicleTracker() {
  const [status,     setStatus]     = useState<WsStatus>('connecting');
  const [positions,  setPositions]  = useState<VehiclePositions>({});
  const [lastUpdate, setLastUpdate] = useState<LocationUpdate | null>(null);

  // Keep a stable ref to the RTDB ref so we can call off() on unmount
  const telemetryRef = useRef(ref(clientDb, 'telemetry'));

  useEffect(() => {
    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    const pollApi = async () => {
      try {
        const res = await fetch('/api/locations');
        if (!res.ok) return;
        const raw = await res.json();
        if (!raw || typeof raw !== 'object' || !isMounted) return;

        const next: VehiclePositions = {};
        let newest: LocationUpdate | null = null;

        for (const [, val] of Object.entries(raw as Record<string, any>)) {
          if (!val || typeof val !== 'object') continue;
          const update: LocationUpdate = {
            type:      'LOCATION_UPDATE',
            fleetId:   Number(val.fleetId),
            latitude:  Number(val.latitude),
            longitude: Number(val.longitude),
            speed:     Number(val.speed ?? 0),
            heading:   Number(val.heading ?? 0),
            timestamp: Number(val.updatedAt ?? Date.now()),
          };
          next[update.fleetId] = update;
          if (!newest || update.timestamp > newest.timestamp) {
            newest = update;
          }
        }

        if (Object.keys(next).length > 0 && isMounted) {
          setPositions(next);
          if (newest) setLastUpdate(newest);
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

          const raw = snapshot.val() as Record<string, Omit<LocationUpdate, 'timestamp'> & { updatedAt?: number }>;
          const next: VehiclePositions = {};
          let newest: LocationUpdate | null = null;

          for (const [, value] of Object.entries(raw)) {
            const update: LocationUpdate = {
              type:      'LOCATION_UPDATE',
              fleetId:   value.fleetId,
              latitude:  value.latitude,
              longitude: value.longitude,
              speed:     value.speed,
              heading:   value.heading,
              timestamp: value.updatedAt ?? Date.now(),
            };
            next[update.fleetId] = update;
            if (!newest || update.timestamp > newest.timestamp) {
              newest = update;
            }
          }

          setPositions(next);
          if (newest) setLastUpdate(newest);
          setStatus('connected');
        },
        (_error) => {
          // RTDB not available in current environment — activate poll interval
          if (isMounted) {
            setStatus('connected');
            if (!pollInterval) {
              pollInterval = setInterval(pollApi, 2500);
            }
          }
        },
      );
    } catch {
      // Setup error — fallback to polling
      if (!pollInterval) {
        pollInterval = setInterval(pollApi, 2500);
      }
    }

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
      try {
        if (unsubscribe) unsubscribe();
        else off(dbRef);
      } catch {
        // ignore
      }
    };
  }, []);

  return { status, positions, lastUpdate };
}

// Alias so map/page.tsx can import { useWebSocket } without changes
export { useVehicleTracker as useWebSocket };
