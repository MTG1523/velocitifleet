import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseRentals, rtdbGet, rtdbPut, rtdbPatch, RentalRecord, FleetVehicle } from '@/lib/firebase-rtdb';

/** GET /api/rentals — all rentals directly from Firebase */
export async function GET() {
  try {
    const rentals = await getFirebaseRentals();
    return NextResponse.json(rentals);
  } catch (err) {
    console.error('[GET /api/rentals]', err);
    return NextResponse.json({ error: 'Failed to fetch rentals from Firebase' }, { status: 500 });
  }
}

/**
 * POST /api/rentals — create a rental.
 * Body: { userId: string, fleetId: string | number, userName?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, fleetId, userName } = await req.json();
    if (!userId || !fleetId) {
      return NextResponse.json({ error: 'userId and fleetId are required' }, { status: 400 });
    }

    const vehicle = await rtdbGet<FleetVehicle>(`fleet/${fleetId}`);
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }
    if (vehicle.status !== 'AVAILABLE') {
      return NextResponse.json({ error: 'Vehicle is currently rented or unavailable' }, { status: 409 });
    }

    const rentalId = `rental_${Date.now()}`;
    const newRental: RentalRecord = {
      id:           rentalId,
      userId:       String(userId),
      userName:     userName || 'VIP Guest',
      fleetId:      Number(fleetId),
      vehicleMake:  vehicle.make,
      vehicleModel: vehicle.model,
      startTime:    new Date().toISOString(),
      endTime:      null,
      status:       'ACTIVE',
      totalCost:    null,
      createdAt:    new Date().toISOString(),
    };

    // Save rental to Firebase & update vehicle status to RENTED
    await rtdbPut(`rentals/${rentalId}`, newRental);
    await rtdbPatch(`fleet/${fleetId}`, { status: 'RENTED' });

    return NextResponse.json(newRental, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/rentals]', err);
    return NextResponse.json({ error: err?.message || 'Failed to create rental in Firebase' }, { status: 500 });
  }
}
