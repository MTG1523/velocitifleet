'use client';

/**
 * useVehicleTracker — Firebase RTDB real-time GPS hook.
 *
 * Drop-in replacement for useWebSocket.ts. Attaches a single onValue
 * listener to /telemetry and returns a VehiclePositions map keyed by
 * fleetId, plus status and lastUpdate — matching the old hook's API.
 *
 * The RTDB listener is cleaned up on unmount via the unsubscribe fn
 * returned by onValue.
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

/**
 * useVehicleTracker — attaches to Firebase RTDB /telemetry.
 *
 * Returns:
 *   status    — 'connecting' | 'connected' | 'error'
 *   positions — Record<fleetId, LocationUpdate>
 *   lastUpdate — most recent LocationUpdate received
 */
export function useVehicleTracker() {
  const [status,     setStatus]     = useState<WsStatus>('connecting');
  const [positions,  setPositions]  = useState<VehiclePositions>({});
  const [lastUpdate, setLastUpdate] = useState<LocationUpdate | null>(null);

  // Keep a stable ref to the RTDB ref so we can call off() on unmount
  const telemetryRef = useRef(ref(clientDb, 'telemetry'));

  useEffect(() => {
    const dbRef = telemetryRef.current;

    try {
      onValue(
        dbRef,
        (snapshot) => {
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
        (error) => {
          console.error('[useVehicleTracker] RTDB error:', error);
          setStatus('error');
        },
      );
    } catch (err) {
      console.error('[useVehicleTracker] Setup error:', err);
      setStatus('error');
    }

    return () => {
      off(dbRef);
    };
  }, []);

  return { status, positions, lastUpdate };
}

// Alias so map/page.tsx can import { useWebSocket } without changes
export { useVehicleTracker as useWebSocket };
