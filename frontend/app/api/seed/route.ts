import { NextResponse } from 'next/server';
import { getFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// ── Seed data — mirrors database/schema.sql ───────────────────────────────

const SEED_FLEET = [
  { make: 'Tesla',  model: 'Model 3',  type: 'Car',        registration: 'VF-001', status: 'AVAILABLE',   year: 2023, dailyRate: 89.99,  imageUrl: '' },
  { make: 'Toyota', model: 'Corolla',  type: 'Car',        registration: 'VF-002', status: 'AVAILABLE',   year: 2022, dailyRate: 45.00,  imageUrl: '' },
  { make: 'Honda',  model: 'CBR 600',  type: 'Motorcycle', registration: 'VF-003', status: 'AVAILABLE',   year: 2023, dailyRate: 35.00,  imageUrl: '' },
  { make: 'Vespa',  model: 'GTS 300',  type: 'Scooter',    registration: 'VF-004', status: 'RENTED',      year: 2022, dailyRate: 25.00,  imageUrl: '' },
  { make: 'Ford',   model: 'Transit',  type: 'Van',        registration: 'VF-005', status: 'AVAILABLE',   year: 2021, dailyRate: 75.00,  imageUrl: '' },
  { make: 'BMW',    model: 'i4',       type: 'Car',        registration: 'VF-006', status: 'MAINTENANCE', year: 2024, dailyRate: 120.00, imageUrl: '' },
  { make: 'Toyota', model: 'HiLux',   type: 'Truck',      registration: 'VF-007', status: 'AVAILABLE',   year: 2021, dailyRate: 95.00,  imageUrl: '' },
  { make: 'Yamaha', model: 'MT-07',   type: 'Motorcycle', registration: 'VF-008', status: 'AVAILABLE',   year: 2023, dailyRate: 30.00,  imageUrl: '' },
];

const SEED_USERS = [
  { name: 'Alice Johnson', phone: '+1-555-0101', email: 'alice@velocitifleet.com',  role: 'ADMIN'    },
  { name: 'Bob Smith',     phone: '+1-555-0102', email: 'bob@velocitifleet.com',    role: 'CUSTOMER' },
  { name: 'Carlos Diaz',  phone: '+1-555-0103', email: 'carlos@velocitifleet.com', role: 'DRIVER'   },
  { name: 'Diana Park',   phone: '+1-555-0104', email: 'diana@velocitifleet.com',  role: 'CUSTOMER' },
  { name: 'Eve Wilson',   phone: '+1-555-0105', email: 'eve@velocitifleet.com',    role: 'DRIVER'   },
];

/**
 * POST /api/seed — idempotent seed for Firestore.
 * Checks for existing docs by unique key before inserting.
 * Returns: { seeded: { fleet: N, users: N } }
 */
export async function POST() {
  try {
    const db = getFirestore();
    let fleetSeeded = 0;
    let usersSeeded = 0;

    // Seed fleet — check by registration
    for (const vehicle of SEED_FLEET) {
      const existing = await db
        .collection('fleet')
        .where('registration', '==', vehicle.registration)
        .limit(1)
        .get();
      if (existing.empty) {
        await db.collection('fleet').add({ ...vehicle, createdAt: FieldValue.serverTimestamp() });
        fleetSeeded++;
      }
    }

    // Seed users — check by email
    for (const user of SEED_USERS) {
      const existing = await db
        .collection('users')
        .where('email', '==', user.email)
        .limit(1)
        .get();
      if (existing.empty) {
        await db.collection('users').add({ ...user, createdAt: FieldValue.serverTimestamp() });
        usersSeeded++;
      }
    }

    return NextResponse.json({ seeded: { fleet: fleetSeeded, users: usersSeeded } });
  } catch (err) {
    console.error('[POST /api/seed]', err);
    return NextResponse.json({ error: 'Seed failed' }, { status: 500 });
  }
}
