import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from '@/lib/firebase-admin';
import { docToRental } from '@/app/api/rentals/route';

type Params = { params: Promise<{ id: string }> };

/** GET /api/rentals/[id] — single rental */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db  = getFirestore();
    const doc = await db.collection('rentals').doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Rental not found' }, { status: 404 });
    }
    return NextResponse.json(docToRental(doc));
  } catch (err) {
    console.error('[GET /api/rentals/[id]]', err);
    return NextResponse.json({ error: 'Failed to fetch rental' }, { status: 500 });
  }
}
