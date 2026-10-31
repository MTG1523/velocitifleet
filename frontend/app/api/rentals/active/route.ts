import { NextResponse } from 'next/server';
import { getFirebaseRentals } from '@/lib/firebase-rtdb';

/** GET /api/rentals/active — only ACTIVE rentals directly from Firebase */
export async function GET() {
  try {
    const rentals = await getFirebaseRentals();
    const active = rentals.filter(r => r.status === 'ACTIVE');
    return NextResponse.json(active);
  } catch (err) {
    console.error('[GET /api/rentals/active]', err);
    return NextResponse.json({ error: 'Failed to fetch active rentals from Firebase' }, { status: 500 });
  }
}
