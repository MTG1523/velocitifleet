import { NextResponse } from 'next/server';
import { getFirebaseFleet } from '@/lib/firebase-rtdb';

/** GET /api/fleet/available — only AVAILABLE vehicles directly from Firebase */
export async function GET() {
  try {
    const fleet = await getFirebaseFleet();
    const available = fleet.filter(v => v.status === 'AVAILABLE');
    return NextResponse.json(available);
  } catch (err) {
    console.error('[GET /api/fleet/available]', err);
    return NextResponse.json({ error: 'Failed to fetch available fleet from Firebase' }, { status: 500 });
  }
}
