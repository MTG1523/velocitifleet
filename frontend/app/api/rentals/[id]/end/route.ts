import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from '@/lib/firebase-admin';
import { docToRental } from '@/app/api/rentals/route';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/rentals/[id]/end — end an active rental.
 *
 * Billing: totalCost = ceil(durationMs / 86_400_000) * dailyRate
 *   e.g. 25 hours at $50/day → ceil(25/24) = 2 days → $100
 *
 * Transaction: update rental (status→COMPLETED, endTime, totalCost)
 *              + update fleet (status→AVAILABLE) atomically.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db         = getFirestore();
    const rentalsCol = db.collection('rentals');
    const rentalRef  = rentalsCol.doc(id);

    await db.runTransaction(async (tx) => {
      const rentalDoc = await tx.get(rentalRef);
      if (!rentalDoc.exists) {
        throw Object.assign(new Error('Rental not found'), { code: 404 });
      }
      const rental = rentalDoc.data()!;
      if (rental.status !== 'ACTIVE') {
        throw Object.assign(new Error('Rental is not active'), { code: 409 });
      }

      const fleetRef = db.collection('fleet').doc(String(rental.fleetId));
      const fleetDoc = await tx.get(fleetRef);
      if (!fleetDoc.exists) {
        throw Object.assign(new Error('Vehicle not found'), { code: 404 });
      }

      const dailyRate: number  = fleetDoc.data()!.dailyRate ?? 0;
      const startMs: number    = rental.startTime.toDate().getTime();
      const endMs: number      = Date.now();
      const diffMs: number     = endMs - startMs;
      const days: number       = Math.ceil(diffMs / 86_400_000);
      const totalCost: number  = parseFloat((days * dailyRate).toFixed(2));

      tx.update(rentalRef, {
        status:    'COMPLETED',
        endTime:   new Date(endMs),
        totalCost,
      });
      tx.update(fleetRef, { status: 'AVAILABLE' });
    });

    const updated = await rentalRef.get();
    return NextResponse.json(docToRental(updated));
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    if (e?.code === 404) return NextResponse.json({ error: e.message }, { status: 404 });
    if (e?.code === 409) return NextResponse.json({ error: e.message }, { status: 409 });
    console.error('[POST /api/rentals/[id]/end]', err);
    return NextResponse.json({ error: 'Failed to end rental' }, { status: 500 });
  }
}
