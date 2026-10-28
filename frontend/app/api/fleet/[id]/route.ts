import { NextRequest, NextResponse } from 'next/server';
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

type Params = { params: Promise<{ id: string }> };

/** GET /api/fleet/[id] — single vehicle */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db  = getFirestore();
    const doc = await db.collection('fleet').doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }
    return NextResponse.json(docToFleet(doc));
  } catch (err) {
    console.error('[GET /api/fleet/[id]]', err);
    return NextResponse.json({ error: 'Failed to fetch vehicle' }, { status: 500 });
  }
}

/** PUT /api/fleet/[id] — update vehicle fields */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const db   = getFirestore();
    const ref  = db.collection('fleet').doc(id);
    const doc  = await ref.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }
    // Only allow updating safe fields
    const allowed = ['make', 'model', 'type', 'registration', 'status', 'year', 'dailyRate', 'imageUrl'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }
    await ref.update(update);
    const updated = await ref.get();
    return NextResponse.json(docToFleet(updated));
  } catch (err) {
    console.error('[PUT /api/fleet/[id]]', err);
    return NextResponse.json({ error: 'Failed to update vehicle' }, { status: 500 });
  }
}

/** DELETE /api/fleet/[id] — remove vehicle */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db  = getFirestore();
    const ref = db.collection('fleet').doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }
    await ref.delete();
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('[DELETE /api/fleet/[id]]', err);
    return NextResponse.json({ error: 'Failed to delete vehicle' }, { status: 500 });
  }
}

/** PATCH /api/fleet/[id] — partial update (e.g. status) */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const queryStatus = searchParams.get('status');
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body may be empty if status is in query param
    }
    const status = queryStatus || body.status;
    const db  = getFirestore();
    const ref = db.collection('fleet').doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }
    const update: Record<string, unknown> = {};
    if (status) update.status = status;
    for (const key of ['make', 'model', 'type', 'registration', 'year', 'dailyRate', 'imageUrl']) {
      if (body[key] !== undefined) update[key] = body[key];
    }
    await ref.update(update);
    const updated = await ref.get();
    return NextResponse.json(docToFleet(updated));
  } catch (err) {
    console.error('[PATCH /api/fleet/[id]]', err);
    return NextResponse.json({ error: 'Failed to update vehicle' }, { status: 500 });
  }
}

