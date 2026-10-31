import { NextRequest, NextResponse } from 'next/server';
import { rtdbGet, RentalRecord } from '@/lib/firebase-rtdb';

type Params = { params: Promise<{ id: string }> };

/** GET /api/rentals/[id] — single rental directly from Firebase */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const rental = await rtdbGet<RentalRecord>(`rentals/${id}`);
    if (!rental) {
      return NextResponse.json({ error: 'Rental not found' }, { status: 404 });
    }
    return NextResponse.json(rental);
  } catch (err) {
    console.error('[GET /api/rentals/[id]]', err);
    return NextResponse.json({ error: 'Failed to fetch rental from Firebase' }, { status: 500 });
  }
}
