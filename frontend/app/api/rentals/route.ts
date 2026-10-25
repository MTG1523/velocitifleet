import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export interface RentalItem {
  id: string;
  userId: string;
  fleetId: string;
  startTime: string;
  endTime: string | null;
  status: string;
  totalCost: number | null;
  createdAt: string;
}

export function docToRental(doc: FirebaseFirestore.DocumentSnapshot): RentalItem {
  const d = doc.data()!;
  return {
    id:        doc.id,
    userId:    d.userId,
    fleetId:   d.fleetId,
    startTime: d.startTime?.toDate?.()?.toISOString() ?? '',
    endTime:   d.endTime?.toDate?.()?.toISOString() ?? null,
    status:    d.status,
    totalCost: d.totalCost ?? null,
    createdAt: d.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
  };
}

/** GET /api/rentals — all rentals */
export async function GET() {
  try {
    const db   = getFirestore();
    const snap = await db.collection('rentals').orderBy('createdAt', 'desc').get();
    return NextResponse.json(snap.docs.map(docToRental));
  } catch (err) {
    console.error('[GET /api/rentals]', err);
    return NextResponse.json({ error: 'Failed to fetch rentals' }, { status: 500 });
  }
}

/**
 * POST /api/rentals — create a rental.
 * Body: { userId: string, fleetId: string }
 * Guard: vehicle must be AVAILABLE — returns 409 if not.
 * Transaction: create rental + set fleet status → RENTED atomically.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, fleetId } = await req.json();
    if (!userId || !fleetId) {
      return NextResponse.json({ error: 'userId and fleetId are required' }, { status: 400 });
    }

    const db        = getFirestore();
    const fleetRef  = db.collection('fleet').doc(String(fleetId));
    const rentalsCol = db.collection('rentals');

    let rentalId: string = '';

    await db.runTransaction(async (tx) => {
      const fleetDoc = await tx.get(fleetRef);
      if (!fleetDoc.exists) {
        throw Object.assign(new Error('Vehicle not found'), { code: 404 });
      }
      if (fleetDoc.data()!.status !== 'AVAILABLE') {
        throw Object.assign(new Error('Vehicle not available'), { code: 409 });
      }

      const rentalRef = rentalsCol.doc();
      rentalId = rentalRef.id;
      tx.set(rentalRef, {
        userId:    String(userId),
        fleetId:   String(fleetId),
        startTime: FieldValue.serverTimestamp(),
        endTime:   null,
        status:    'ACTIVE',
        totalCost: null,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.update(fleetRef, { status: 'RENTED' });
    });

    const created = await rentalsCol.doc(rentalId).get();
    return NextResponse.json(docToRental(created), { status: 201 });
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    if (e?.code === 404) return NextResponse.json({ error: e.message }, { status: 404 });
    if (e?.code === 409) return NextResponse.json({ error: e.message }, { status: 409 });
    console.error('[POST /api/rentals]', err);
    return NextResponse.json({ error: 'Failed to create rental' }, { status: 500 });
  }
}
