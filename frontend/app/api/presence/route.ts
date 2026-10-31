import { NextRequest, NextResponse } from 'next/server';
import { rtdbGet } from '@/lib/firebase-rtdb';

/**
 * GET /api/presence — Returns all driver presence records directly from Firebase RTDB /driver_presence.
 */
export async function GET(_req: NextRequest) {
  try {
    const presence = await rtdbGet<Record<string, any>>('driver_presence') || {};

    const drivers = Object.values(presence).filter(Boolean).map((d: any) => ({
      driverName:  d.driverName  || 'Executive Driver',
      driverEmail: d.driverEmail || '',
      driverPhoto: d.driverPhoto || '',
      fleetId:     d.fleetId     || null,
      online:      Boolean(d.online),
      lastSeen:    d.lastSeen    || 0,
    }));

    return NextResponse.json({ drivers });
  } catch (err) {
    console.error('[GET /api/presence]', err);
    return NextResponse.json({ drivers: [] });
  }
}
