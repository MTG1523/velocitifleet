import { NextRequest, NextResponse } from 'next/server';
import { rtdbGet, rtdbPatch, rtdbDelete, FleetVehicle } from '@/lib/firebase-rtdb';

type Params = { params: Promise<{ id: string }> };

/** GET /api/fleet/[id] — single vehicle directly from Firebase */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const vehicle = await rtdbGet<FleetVehicle>(`fleet/${id}`);
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }
    return NextResponse.json(vehicle);
  } catch (err) {
    console.error('[GET /api/fleet/[id]]', err);
    return NextResponse.json({ error: 'Failed to fetch vehicle from Firebase' }, { status: 500 });
  }
}

/** PUT /api/fleet/[id] — update vehicle fields directly in Firebase */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const existing = await rtdbGet<FleetVehicle>(`fleet/${id}`);
    if (!existing) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }
    const update: Partial<FleetVehicle> = {};
    const allowed = ['make', 'model', 'type', 'registration', 'status', 'year', 'dailyRate', 'hourlyRate', 'fuelLevel', 'locationName', 'imageUrl'];
    for (const key of allowed) {
      if (body[key] !== undefined) (update as any)[key] = body[key];
    }
    await rtdbPatch(`fleet/${id}`, update);
    const updated = await rtdbGet<FleetVehicle>(`fleet/${id}`);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[PUT /api/fleet/[id]]', err);
    return NextResponse.json({ error: 'Failed to update vehicle in Firebase' }, { status: 500 });
  }
}

/** DELETE /api/fleet/[id] — remove vehicle from Firebase */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await rtdbDelete(`fleet/${id}`);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('[DELETE /api/fleet/[id]]', err);
    return NextResponse.json({ error: 'Failed to delete vehicle from Firebase' }, { status: 500 });
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
    const existing = await rtdbGet<FleetVehicle>(`fleet/${id}`);
    if (!existing) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }
    const update: any = {};
    if (status) update.status = status;
    for (const key of ['make', 'model', 'type', 'registration', 'year', 'dailyRate', 'hourlyRate', 'fuelLevel', 'locationName', 'imageUrl']) {
      if (body[key] !== undefined) update[key] = body[key];
    }
    await rtdbPatch(`fleet/${id}`, update);
    const updated = await rtdbGet<FleetVehicle>(`fleet/${id}`);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[PATCH /api/fleet/[id]]', err);
    return NextResponse.json({ error: 'Failed to update vehicle in Firebase' }, { status: 500 });
  }
}
