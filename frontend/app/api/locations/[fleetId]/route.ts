import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/firebase-admin';

type Params = { params: Promise<{ fleetId: string }> };

/** GET /api/locations/[fleetId] — latest GPS position for a vehicle */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { fleetId } = await params;
    const rtdb        = getDatabase();
    const snap        = await rtdb.ref(`/telemetry/${fleetId}`).get();

    if (!snap.exists()) {
      return NextResponse.json({ error: 'No telemetry found for this vehicle' }, { status: 404 });
    }

    return NextResponse.json(snap.val());
  } catch (err) {
    console.error('[GET /api/locations/[fleetId]]', err);
    return NextResponse.json({ error: 'Failed to fetch location' }, { status: 500 });
  }
}
