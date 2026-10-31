import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseFleet, rtdbPut, FleetVehicle } from '@/lib/firebase-rtdb';

/** GET /api/fleet — all vehicles directly from Firebase Realtime Database */
export async function GET() {
  try {
    const fleet = await getFirebaseFleet();
    return NextResponse.json(fleet);
  } catch (err) {
    console.error('[GET /api/fleet]', err);
    return NextResponse.json({ error: 'Failed to fetch fleet from Firebase' }, { status: 500 });
  }
}

/** POST /api/fleet — create or update a vehicle directly in Firebase */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const existing = await getFirebaseFleet();
    const nextId = body.id ? Number(body.id) : (existing.length > 0 ? Math.max(...existing.map(v => v.id)) + 1 : 1);

    const vehicle: FleetVehicle = {
      id:           nextId,
      make:         body.make || 'Custom Luxury',
      model:        body.model || 'Edition',
      type:         body.type || 'Car',
      registration: body.registration || `VF-00${nextId}`,
      status:       body.status ?? 'AVAILABLE',
      year:         Number(body.year) || 2024,
      dailyRate:    Number(body.dailyRate) || 120,
      hourlyRate:   Number(body.hourlyRate) || 25,
      fuelLevel:    Number(body.fuelLevel) || 100,
      locationName: body.locationName || 'Chennai Headquarters',
      imageUrl:     body.imageUrl ?? '',
      createdAt:    new Date().toISOString(),
    };

    await rtdbPut(`fleet/${nextId}`, vehicle);
    return NextResponse.json(vehicle, { status: 201 });
  } catch (err) {
    console.error('[POST /api/fleet]', err);
    return NextResponse.json({ error: 'Failed to create vehicle in Firebase' }, { status: 500 });
  }
}
