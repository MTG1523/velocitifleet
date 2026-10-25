import { NextResponse } from 'next/server';
import { getFirestore } from '@/lib/firebase-admin';
import { docToRental } from '../route';

/** GET /api/rentals/active — only ACTIVE rentals */
export async function GET() {
  try {
    const db   = getFirestore();
    const snap = await db
      .collection('rentals')
      .where('status', '==', 'ACTIVE')
      .orderBy('createdAt', 'desc')
      .get();
    return NextResponse.json(snap.docs.map(docToRental));
  } catch (err) {
    console.error('[GET /api/rentals/active]', err);
    return NextResponse.json({ error: 'Failed to fetch active rentals' }, { status: 500 });
  }
}
