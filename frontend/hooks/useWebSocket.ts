'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────

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

// ── Hook ──────────────────────────────────────────────────────

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws/location';
const RECONNECT_BASE_DELAY = 2000;
const MAX_RECONNECT_DELAY  = 30000;

/**
 * useWebSocket — singleton WebSocket connection hook.
 *
 * Connects to the Spring Boot WebSocket server at /ws/location.
 * Listens for LOCATION_UPDATE messages and maintains a map of
 * the most recent position for every vehicle.
 *
 * Features:
 *  - Auto-reconnect with exponential back-off
 *  - Status tracking: connecting | connected | error | offline
 *  - Stable vehiclePositions reference (only changes when data changes)
 */
export function useWebSocket() {
  const [status, setStatus]        = useState<WsStatus>('connecting');
  const [positions, setPositions]  = useState<VehiclePositions>({});
  const [lastUpdate, setLastUpdate] = useState<LocationUpdate | null>(null);

  const wsRef         = useRef<WebSocket | null>(null);
  const reconnectRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef    = useRef(0);
  const unmountedRef  = useRef(false);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    setStatus('connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) { ws.close(); return; }
      setStatus('connected');
      attemptRef.current = 0;
      console.log('[WS] Connected to VelocitiFleet backend');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as LocationUpdate;
        if (msg.type === 'LOCATION_UPDATE') {
          setPositions(prev => ({ ...prev, [msg.fleetId]: msg }));
          setLastUpdate(msg);
        }
      } catch {
        console.warn('[WS] Could not parse message:', event.data);
      }
    };

    ws.onerror = () => {
      if (!unmountedRef.current) setStatus('error');
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      setStatus('offline');
      wsRef.current = null;

      // Exponential back-off reconnect
      const delay = Math.min(
        RECONNECT_BASE_DELAY * Math.pow(1.5, attemptRef.current),
        MAX_RECONNECT_DELAY
      );
      attemptRef.current += 1;
      console.log(`[WS] Disconnected. Reconnecting in ${(delay / 1000).toFixed(1)}s...`);
      reconnectRef.current = setTimeout(connect, delay);
    };
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return { status, positions, lastUpdate };
}
