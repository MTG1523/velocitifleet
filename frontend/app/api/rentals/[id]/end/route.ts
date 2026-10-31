import { NextRequest, NextResponse } from 'next/server';
import { rtdbGet, rtdbPatch, RentalRecord, FleetVehicle } from '@/lib/firebase-rtdb';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/rentals/[id]/end — end an active rental directly in Firebase.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const rental = await rtdbGet<RentalRecord>(`rentals/${id}`);
    if (!rental) {
      return NextResponse.json({ error: 'Rental not found' }, { status: 404 });
    }
    if (rental.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Rental is not active' }, { status: 409 });
    }

    const vehicle = await rtdbGet<FleetVehicle>(`fleet/${rental.fleetId}`);
    const dailyRate = vehicle?.dailyRate ?? 120;
    const startMs = new Date(rental.startTime).getTime();
    const endMs = Date.now();
    const diffMs = Math.max(0, endMs - startMs);
    const days = Math.max(1, Math.ceil(diffMs / 86_400_000));
    const totalCost = parseFloat((days * dailyRate).toFixed(2));

    const updatedRental: Partial<RentalRecord> = {
      status: 'COMPLETED',
      endTime: new Date(endMs).toISOString(),
      totalCost,
    };

    // Update rental & free vehicle back to AVAILABLE in Firebase
    await rtdbPatch(`rentals/${id}`, updatedRental);
    await rtdbPatch(`fleet/${rental.fleetId}`, { status: 'AVAILABLE' });

    const finalRecord = await rtdbGet<RentalRecord>(`rentals/${id}`);
    return NextResponse.json(finalRecord);
  } catch (err: any) {
    console.error('[POST /api/rentals/[id]/end]', err);
    return NextResponse.json({ error: err?.message || 'Failed to end rental in Firebase' }, { status: 500 });
  }
}
