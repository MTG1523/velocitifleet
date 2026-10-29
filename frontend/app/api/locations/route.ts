import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/firebase-admin';

export interface TelemetryPoint {
  fleetId: number;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  updatedAt: number;
  driverName?: string;
  driverEmail?: string;
  driverPhoto?: string;
  accuracy?: number;
}

/**
 * POST /api/locations — ingest a driver's GPS ping.
 * Writes to Firebase RTDB at /telemetry/{fleetId} with driver profile.
 * Body: { fleetId, latitude, longitude, speed, heading, driverName, driverEmail, driverPhoto, accuracy }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      fleetId,
      latitude,
      longitude,
      speed,
      heading,
      driverName,
      driverEmail,
      driverPhoto,
      accuracy,
    } = body;

    if (!fleetId || latitude == null || longitude == null) {
      return NextResponse.json({ error: 'fleetId, latitude and longitude are required' }, { status: 400 });
    }

    const timestamp = Date.now();
    const point: TelemetryPoint = {
      fleetId:     Number(fleetId),
      latitude:    Number(latitude),
      longitude:   Number(longitude),
      speed:       Number(speed ?? 0),
      heading:     Number(heading ?? 0),
      updatedAt:   timestamp,
      driverName:  driverName || 'Executive Driver',
      driverEmail: driverEmail || 'driver@velocitifleet.com',
      driverPhoto: driverPhoto || '',
      accuracy:    accuracy ? Number(accuracy) : 5,
    };

    const rtdb = getDatabase();

    // 1. Update latest vehicle location
    await rtdb.ref(`/telemetry/${fleetId}`).set(point);

    // 2. Also append to live telemetry update stream (store last 30 updates)
    try {
      const streamRef = rtdb.ref('/telemetry_stream');
      const snap = await streamRef.get();
      let stream = snap.exists() ? (Array.isArray(snap.val()) ? snap.val() : Object.values(snap.val())) : [];
      stream.unshift({ ...point, id: `${fleetId}_${timestamp}` });
      if (stream.length > 50) stream = stream.slice(0, 50);
      await streamRef.set(stream);
    } catch {
      // Non-fatal if stream append fails
    }

    return NextResponse.json({ ok: true, point });
  } catch (err) {
    console.error('[POST /api/locations]', err);
    return NextResponse.json({ error: 'Failed to ingest location' }, { status: 500 });
  }
}

/** GET /api/locations — all latest vehicle locations with driver metadata */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeStream = searchParams.get('stream') === 'true';

    const rtdb = getDatabase();
    const snap = await rtdb.ref('/telemetry').get();
    const locations = snap.exists() ? snap.val() : {};

    if (includeStream) {
      const streamSnap = await rtdb.ref('/telemetry_stream').get();
      const stream = streamSnap.exists()
        ? (Array.isArray(streamSnap.val()) ? streamSnap.val() : Object.values(streamSnap.val()))
        : [];
      return NextResponse.json({ locations, stream });
    }

    return NextResponse.json(locations);
  } catch (err) {
    console.error('[GET /api/locations]', err);
    return NextResponse.json({});
  }
}
