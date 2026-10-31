/**
 * firebase-rtdb.ts — Universal Firebase Realtime Database interface for VelocitiFleet.
 *
 * Ensures all data across the platform (Fleet info, Rentals, Live Telemetry,
 * Driver Presence, Dispatch Commands, and User sync) lives directly in Firebase
 * as the single source of truth.
 */

const RTDB_BASE_URL = (
  process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
  'https://velocitifleet-default-rtdb.firebaseio.com'
).replace(/\/$/, '');

export interface FleetVehicle {
  id: number;
  make: string;
  model: string;
  type: string;
  registration: string;
  status: 'AVAILABLE' | 'RENTED' | 'MAINTENANCE';
  year: number;
  dailyRate: number;
  hourlyRate: number;
  fuelLevel: number;
  locationName: string;
  imageUrl: string;
  createdAt: string;
}

export interface RentalRecord {
  id: string;
  userId: string;
  userName?: string;
  fleetId: number;
  vehicleMake?: string;
  vehicleModel?: string;
  startTime: string;
  endTime: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  totalCost: number | null;
  createdAt: string;
}

export const INITIAL_FLEET_DATA: Record<string, FleetVehicle> = {
  '1': {
    id: 1,
    make: 'Tesla',
    model: 'Model 3 Performance',
    type: 'Car',
    registration: 'VF-001',
    status: 'AVAILABLE',
    year: 2024,
    dailyRate: 149.00,
    hourlyRate: 25.00,
    fuelLevel: 92,
    locationName: 'Marina Beach Bay',
    imageUrl: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=800&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString()
  },
  '2': {
    id: 2,
    make: 'Mercedes-Maybach',
    model: 'S 680 V12',
    type: 'Car',
    registration: 'VF-002',
    status: 'AVAILABLE',
    year: 2024,
    dailyRate: 349.00,
    hourlyRate: 55.00,
    fuelLevel: 85,
    locationName: 'T. Nagar Luxury Row',
    imageUrl: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString()
  },
  '3': {
    id: 3,
    make: 'Rolls-Royce',
    model: 'Ghost Black Badge',
    type: 'Car',
    registration: 'VF-003',
    status: 'AVAILABLE',
    year: 2024,
    dailyRate: 499.00,
    hourlyRate: 85.00,
    fuelLevel: 90,
    locationName: 'Anna Nagar Executive Hub',
    imageUrl: 'https://images.unsplash.com/photo-1631295868223-63265b40d9e4?w=800&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString()
  },
  '4': {
    id: 4,
    make: 'Porsche',
    model: '911 Turbo S',
    type: 'Car',
    registration: 'VF-004',
    status: 'AVAILABLE',
    year: 2024,
    dailyRate: 299.00,
    hourlyRate: 45.00,
    fuelLevel: 78,
    locationName: 'OMR Cyber Highway',
    imageUrl: 'https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=800&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString()
  },
  '5': {
    id: 5,
    make: 'Range Rover',
    model: 'Autobiography LWB',
    type: 'Van',
    registration: 'VF-005',
    status: 'AVAILABLE',
    year: 2024,
    dailyRate: 279.00,
    hourlyRate: 42.00,
    fuelLevel: 88,
    locationName: 'Chennai International Terminal',
    imageUrl: 'https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?w=800&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString()
  },
  '6': {
    id: 6,
    make: 'BMW',
    model: 'i7 M70 xDrive',
    type: 'Car',
    registration: 'VF-006',
    status: 'AVAILABLE',
    year: 2024,
    dailyRate: 239.00,
    hourlyRate: 38.00,
    fuelLevel: 95,
    locationName: 'Nungambakkam High Road',
    imageUrl: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString()
  },
  '7': {
    id: 7,
    make: 'Cadillac',
    model: 'Escalade ESV Premium',
    type: 'Truck',
    registration: 'VF-007',
    status: 'AVAILABLE',
    year: 2023,
    dailyRate: 219.00,
    hourlyRate: 35.00,
    fuelLevel: 80,
    locationName: 'ECR Coastal Corridor',
    imageUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString()
  },
  '8': {
    id: 8,
    make: 'Bentley',
    model: 'Continental GT Speed',
    type: 'Car',
    registration: 'VF-008',
    status: 'AVAILABLE',
    year: 2024,
    dailyRate: 389.00,
    hourlyRate: 60.00,
    fuelLevel: 84,
    locationName: 'Velachery Tech Corridor',
    imageUrl: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString()
  }
};

/** Fetch raw data from Firebase Realtime Database */
export async function rtdbGet<T = any>(path: string): Promise<T | null> {
  const cleanPath = path.replace(/^\//, '');
  const url = `${RTDB_BASE_URL}/${cleanPath}.json`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`[RTDB GET /${cleanPath}] failed:`, err);
    return null;
  }
}

/** Set/Overwrite data in Firebase Realtime Database */
export async function rtdbPut<T = any>(path: string, body: any): Promise<T | null> {
  const cleanPath = path.replace(/^\//, '');
  const url = `${RTDB_BASE_URL}/${cleanPath}.json`;
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`[RTDB PUT /${cleanPath}] failed:`, err);
    return null;
  }
}

/** Patch (merge) data in Firebase Realtime Database */
export async function rtdbPatch<T = any>(path: string, body: any): Promise<T | null> {
  const cleanPath = path.replace(/^\//, '');
  const url = `${RTDB_BASE_URL}/${cleanPath}.json`;
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`[RTDB PATCH /${cleanPath}] failed:`, err);
    return null;
  }
}

/** Push (auto-ID) data in Firebase Realtime Database */
export async function rtdbPost<T = any>(path: string, body: any): Promise<T | null> {
  const cleanPath = path.replace(/^\//, '');
  const url = `${RTDB_BASE_URL}/${cleanPath}.json`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`[RTDB POST /${cleanPath}] failed:`, err);
    return null;
  }
}

/** Delete data in Firebase Realtime Database */
export async function rtdbDelete(path: string): Promise<boolean> {
  const cleanPath = path.replace(/^\//, '');
  const url = `${RTDB_BASE_URL}/${cleanPath}.json`;
  try {
    const res = await fetch(url, { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    console.warn(`[RTDB DELETE /${cleanPath}] failed:`, err);
    return false;
  }
}

/**
 * Get all fleet vehicles from Firebase RTDB.
 * Auto-seeds with luxury vehicle catalog if Firebase node is empty.
 */
export async function getFirebaseFleet(): Promise<FleetVehicle[]> {
  const data = await rtdbGet<Record<string, any>>('fleet');
  if (data && typeof data === 'object') {
    const list = Array.isArray(data)
      ? data.filter(Boolean)
      : Object.values(data).filter(Boolean);
    if (list.length > 0) {
      return list.map(v => ({
        id: Number(v.id),
        make: v.make || 'Vehicle',
        model: v.model || '',
        type: v.type || 'Car',
        registration: v.registration || `VF-00${v.id}`,
        status: (v.status || 'AVAILABLE') as FleetVehicle['status'],
        year: Number(v.year) || 2024,
        dailyRate: Number(v.dailyRate) || 99,
        hourlyRate: Number(v.hourlyRate) || 25,
        fuelLevel: Number(v.fuelLevel) || 90,
        locationName: v.locationName || 'Chennai Metro Area',
        imageUrl: v.imageUrl || '',
        createdAt: v.createdAt || new Date().toISOString(),
      }));
    }
  }

  // Auto-seed into Firebase if empty
  await rtdbPut('fleet', INITIAL_FLEET_DATA);
  return Object.values(INITIAL_FLEET_DATA);
}

/**
 * Get all rentals from Firebase RTDB.
 */
export async function getFirebaseRentals(): Promise<RentalRecord[]> {
  const data = await rtdbGet<Record<string, any>>('rentals');
  if (!data || typeof data !== 'object') return [];
  const list = Array.isArray(data)
    ? data.filter(Boolean)
    : Object.values(data).filter(Boolean);
  return list.map(r => ({
    id: String(r.id),
    userId: String(r.userId || ''),
    userName: r.userName || 'VIP Guest',
    fleetId: Number(r.fleetId),
    vehicleMake: r.vehicleMake || '',
    vehicleModel: r.vehicleModel || '',
    startTime: r.startTime || new Date().toISOString(),
    endTime: r.endTime || null,
    status: (r.status || 'ACTIVE') as RentalRecord['status'],
    totalCost: r.totalCost != null ? Number(r.totalCost) : null,
    createdAt: r.createdAt || new Date().toISOString(),
  }));
}
