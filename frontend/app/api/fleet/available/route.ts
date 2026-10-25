import { NextResponse } from 'next/server';
import { getFirestore } from '@/lib/firebase-admin';
import type { FleetItem } from '../route';

function docToFleet(doc: FirebaseFirestore.DocumentSnapshot): FleetItem {
  const d = doc.data()!;
  return {
    id:           doc.id,
    make:         d.make,
    model:        d.model,
    type:         d.type,
    registration: d.registration,
    status:       d.status,
    year:         d.year,
    dailyRate:    d.dailyRate,
    imageUrl:     d.imageUrl ?? '',
    createdAt:    d.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
  };
}

/** GET /api/fleet/available — only AVAILABLE vehicles */
export async function GET() {
  try {
    const db = getFirestore();
    const snap = await db
      .collection('fleet')
      .where('status', '==', 'AVAILABLE')
      .orderBy('createdAt', 'asc')
      .get();
    const items: FleetItem[] = snap.docs.map(docToFleet);
    return NextResponse.json(items);
  } catch (err) {
    console.error('[GET /api/fleet/available]', err);
    return NextResponse.json({ error: 'Failed to fetch available fleet' }, { status: 500 });
  }
}
