import { NextResponse } from 'next/server';
import { rtdbPut, INITIAL_FLEET_DATA } from '@/lib/firebase-rtdb';

const INITIAL_TELEMETRY: Record<string, any> = {
  '1': { fleetId: 1, latitude: 13.0500, longitude: 80.2824, speed: 42, heading: 20,  updatedAt: Date.now() },
  '2': { fleetId: 2, latitude: 13.0418, longitude: 80.2341, speed: 28, heading: 180, updatedAt: Date.now() },
  '3': { fleetId: 3, latitude: 13.0850, longitude: 80.2100, speed: 52, heading: 90,  updatedAt: Date.now() },
  '4': { fleetId: 4, latitude: 12.9897, longitude: 80.2479, speed: 34, heading: 195, updatedAt: Date.now() },
  '5': { fleetId: 5, latitude: 12.9941, longitude: 80.1709, speed: 48, heading: 45,  updatedAt: Date.now() },
  '6': { fleetId: 6, latitude: 13.0600, longitude: 80.2400, speed: 0,  heading: 0,   updatedAt: Date.now() },
  '7': { fleetId: 7, latitude: 12.9830, longitude: 80.2594, speed: 55, heading: 180, updatedAt: Date.now() },
  '8': { fleetId: 8, latitude: 12.9815, longitude: 80.2180, speed: 38, heading: 270, updatedAt: Date.now() },
};

/**
 * POST /api/seed — Seeds all core data directly into Firebase Realtime Database.
 */
export async function POST() {
  try {
    await Promise.all([
      rtdbPut('fleet', INITIAL_FLEET_DATA),
      rtdbPut('telemetry', INITIAL_TELEMETRY),
    ]);

    return NextResponse.json({
      ok: true,
      message: 'All fleet, telemetry, and platform data successfully seeded directly in Firebase RTDB!',
      vehiclesCount: Object.keys(INITIAL_FLEET_DATA).length,
    });
  } catch (err: any) {
    console.error('[POST /api/seed]', err);
    return NextResponse.json({ error: err?.message || 'Failed to seed Firebase data' }, { status: 500 });
  }
}
