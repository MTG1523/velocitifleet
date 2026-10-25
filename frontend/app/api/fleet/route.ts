import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export interface FleetItem {
  id: string;
  make: string;
  model: string;
  type: string;
  registration: string;
  status: string;
  year: number;
  dailyRate: number;
  imageUrl: string;
  createdAt: string;
}

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

/** GET /api/fleet — all vehicles */
export async function GET() {
  try {
    const db = getFirestore();
    const snap = await db.collection('fleet').orderBy('createdAt', 'asc').get();
    const items: FleetItem[] = snap.docs.map(docToFleet);
    return NextResponse.json(items);
  } catch (err) {
    console.error('[GET /api/fleet]', err);
    return NextResponse.json({ error: 'Failed to fetch fleet' }, { status: 500 });
  }
}

/** POST /api/fleet — create a vehicle */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = getFirestore();
    const ref = await db.collection('fleet').add({
      make:         body.make,
      model:        body.model,
      type:         body.type,
      registration: body.registration,
      status:       body.status ?? 'AVAILABLE',
      year:         body.year ?? null,
      dailyRate:    body.dailyRate ?? null,
      imageUrl:     body.imageUrl ?? '',
      createdAt:    FieldValue.serverTimestamp(),
    });
    const created = await ref.get();
    return NextResponse.json(docToFleet(created), { status: 201 });
  } catch (err) {
    console.error('[POST /api/fleet]', err);
    return NextResponse.json({ error: 'Failed to create vehicle' }, { status: 500 });
  }
}
