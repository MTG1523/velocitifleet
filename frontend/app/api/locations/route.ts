import { NextRequest, NextResponse } from 'next/server';
import { rtdbGet, rtdbPut } from '@/lib/firebase-rtdb';

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
 * POST /api/locations — ingest a driver's GPS ping directly into Firebase RTDB.
 * Writes to: /telemetry/{fleetId}
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

    const lat = Number(latitude);
    const lng = Number(longitude);
    const fId = Number(fleetId);

    if (!Number.isFinite(fId) || !Number.isFinite(lat) || !Number.isFinite(lng) || isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: 'Valid numeric fleetId, latitude and longitude are required' },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const point: TelemetryPoint = {
      fleetId:     fId,
      latitude:    lat,
      longitude:   lng,
      speed:       Number.isFinite(Number(speed)) ? Number(speed) : 0,
      heading:     Number.isFinite(Number(heading)) ? Number(heading) : 0,
      updatedAt:   timestamp,
      driverName:  driverName || 'Executive Driver',
      driverEmail: driverEmail || 'driver@velocitifleet.com',
      driverPhoto: driverPhoto || '',
      accuracy:    accuracy ? Number(accuracy) : 5,
    };

    // 1. Write to Firebase RTDB at /telemetry/{fleetId}
    await rtdbPut(`telemetry/${fId}`, point);

    // 2. Also append to live telemetry update stream (store last 50 updates)
    try {
      const currentStream = await rtdbGet<any[]>('telemetry_stream') || [];
      const stream = Array.isArray(currentStream) ? currentStream : Object.values(currentStream);
      stream.unshift({ ...point, id: `${fId}_${timestamp}` });
      const trimmed = stream.slice(0, 50);
      await rtdbPut('telemetry_stream', trimmed);
    } catch {
      // Non-fatal stream failure
    }

    return NextResponse.json({ ok: true, point });
  } catch (err) {
    console.error('[POST /api/locations]', err);
    return NextResponse.json({ error: 'Failed to ingest location into Firebase' }, { status: 500 });
  }
}

/** GET /api/locations — all latest vehicle locations directly from Firebase RTDB */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeStream = searchParams.get('stream') === 'true';

    const rawTelemetry = await rtdbGet<Record<string, any>>('telemetry') || {};

    // Filter out null array gaps and invalid GPS points
    const locations: Record<string, TelemetryPoint> = {};
    const entries = Array.isArray(rawTelemetry)
      ? rawTelemetry.map((v, i) => [String(i), v] as [string, any])
      : Object.entries(rawTelemetry);

    for (const [, val] of entries) {
      if (!val || typeof val !== 'object') continue;
      const lat = Number(val.latitude);
      const lng = Number(val.longitude);
      const fId = Number(val.fleetId);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || isNaN(lat) || isNaN(lng) || !Number.isFinite(fId)) {
        continue; // Skip invalid or corrupted points
      }
      locations[String(fId)] = {
        fleetId:     fId,
        latitude:    lat,
        longitude:   lng,
        speed:       Number(val.speed ?? 0),
        heading:     Number(val.heading ?? 0),
        updatedAt:   Number(val.updatedAt ?? Date.now()),
        driverName:  val.driverName || '',
        driverEmail: val.driverEmail || '',
        driverPhoto: val.driverPhoto || '',
        accuracy:    val.accuracy ? Number(val.accuracy) : 5,
      };
    }

    if (includeStream) {
      const rawStream = await rtdbGet<any[]>('telemetry_stream') || [];
      const stream = (Array.isArray(rawStream) ? rawStream : Object.values(rawStream))
        .filter(p => p && Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)));
      return NextResponse.json({ locations, stream });
    }

    return NextResponse.json(locations);
  } catch (err) {
    console.error('[GET /api/locations]', err);
    return NextResponse.json({});
  }
}
