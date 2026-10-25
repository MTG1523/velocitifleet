import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/firebase-admin';

export interface TelemetryPoint {
  fleetId: number;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  updatedAt: number;
}

/**
 * POST /api/locations — ingest a GPS ping.
 * Writes to Firebase RTDB at /telemetry/{fleetId} (overwrite, not append).
 * Body: { fleetId, latitude, longitude, speed, heading }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fleetId, latitude, longitude, speed, heading } = body;

    if (!fleetId || latitude == null || longitude == null) {
      return NextResponse.json({ error: 'fleetId, latitude and longitude are required' }, { status: 400 });
    }

    const db: TelemetryPoint = {
      fleetId:   Number(fleetId),
      latitude:  Number(latitude),
      longitude: Number(longitude),
      speed:     Number(speed ?? 0),
      heading:   Number(heading ?? 0),
      updatedAt: Date.now(),
    };

    const rtdb = getDatabase();
    await rtdb.ref(`/telemetry/${fleetId}`).set(db);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/locations]', err);
    return NextResponse.json({ error: 'Failed to ingest location' }, { status: 500 });
  }
}
