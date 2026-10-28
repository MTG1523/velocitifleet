/**
 * mock-store.ts — In-memory Firestore & Realtime Database mock.
 *
 * Provides a drop-in in-memory replacement for Firebase Admin Firestore
 * and Realtime Database when real credentials are not configured.
 * Pre-seeded with fleet, users, and initial telemetry data.
 */

export interface MockDoc {
  id: string;
  [key: string]: any;
}

// ── Initial Seed Data ─────────────────────────────────────────────────────

const INITIAL_FLEET: MockDoc[] = [
  { id: '1', make: 'Tesla',  model: 'Model 3',  type: 'Car',        registration: 'VF-001', status: 'AVAILABLE',   year: 2023, dailyRate: 89.99,  imageUrl: '', createdAt: new Date(Date.now() - 86400000 * 10) },
  { id: '2', make: 'Toyota', model: 'Corolla',  type: 'Car',        registration: 'VF-002', status: 'AVAILABLE',   year: 2022, dailyRate: 45.00,  imageUrl: '', createdAt: new Date(Date.now() - 86400000 * 9) },
  { id: '3', make: 'Honda',  model: 'CBR 600',  type: 'Motorcycle', registration: 'VF-003', status: 'AVAILABLE',   year: 2023, dailyRate: 35.00,  imageUrl: '', createdAt: new Date(Date.now() - 86400000 * 8) },
  { id: '4', make: 'Vespa',  model: 'GTS 300',  type: 'Scooter',    registration: 'VF-004', status: 'RENTED',      year: 2022, dailyRate: 25.00,  imageUrl: '', createdAt: new Date(Date.now() - 86400000 * 7) },
  { id: '5', make: 'Ford',   model: 'Transit',  type: 'Van',        registration: 'VF-005', status: 'AVAILABLE',   year: 2021, dailyRate: 75.00,  imageUrl: '', createdAt: new Date(Date.now() - 86400000 * 6) },
  { id: '6', make: 'BMW',    model: 'i4',       type: 'Car',        registration: 'VF-006', status: 'MAINTENANCE', year: 2024, dailyRate: 120.00, imageUrl: '', createdAt: new Date(Date.now() - 86400000 * 5) },
  { id: '7', make: 'Toyota', model: 'HiLux',   type: 'Truck',      registration: 'VF-007', status: 'AVAILABLE',   year: 2021, dailyRate: 95.00,  imageUrl: '', createdAt: new Date(Date.now() - 86400000 * 4) },
  { id: '8', make: 'Yamaha', model: 'MT-07',   type: 'Motorcycle', registration: 'VF-008', status: 'AVAILABLE',   year: 2023, dailyRate: 30.00,  imageUrl: '', createdAt: new Date(Date.now() - 86400000 * 3) },
];

const INITIAL_USERS: MockDoc[] = [
  { id: '1', name: 'Alice Johnson', phone: '+1-555-0101', email: 'alice@velocitifleet.com',  role: 'ADMIN',    createdAt: new Date(Date.now() - 86400000 * 12) },
  { id: '2', name: 'Bob Smith',     phone: '+1-555-0102', email: 'bob@velocitifleet.com',    role: 'CUSTOMER', createdAt: new Date(Date.now() - 86400000 * 11) },
  { id: '3', name: 'Carlos Diaz',  phone: '+1-555-0103', email: 'carlos@velocitifleet.com', role: 'DRIVER',   createdAt: new Date(Date.now() - 86400000 * 10) },
  { id: '4', name: 'Diana Park',   phone: '+1-555-0104', email: 'diana@velocitifleet.com',  role: 'CUSTOMER', createdAt: new Date(Date.now() - 86400000 * 9) },
  { id: '5', name: 'Eve Wilson',   phone: '+1-555-0105', email: 'eve@velocitifleet.com',    role: 'DRIVER',   createdAt: new Date(Date.now() - 86400000 * 8) },
];

const INITIAL_RENTALS: MockDoc[] = [
  {
    id: '1',
    userId: '2',
    fleetId: '4',
    startTime: new Date(Date.now() - 3600000 * 8),
    endTime: null,
    status: 'ACTIVE',
    totalCost: null,
    createdAt: new Date(Date.now() - 3600000 * 8),
  },
];

const INITIAL_TELEMETRY: Record<string, any> = {
  '1': { fleetId: 1, latitude: 37.7749, longitude: -122.4194, speed: 45, heading: 90,  updatedAt: Date.now() },
  '2': { fleetId: 2, latitude: 37.7833, longitude: -122.4167, speed: 30, heading: 180, updatedAt: Date.now() },
  '3': { fleetId: 3, latitude: 37.7690, longitude: -122.4467, speed: 55, heading: 45,  updatedAt: Date.now() },
  '4': { fleetId: 4, latitude: 37.7900, longitude: -122.4000, speed: 20, heading: 270, updatedAt: Date.now() },
  '5': { fleetId: 5, latitude: 37.7500, longitude: -122.4200, speed: 40, heading: 120, updatedAt: Date.now() },
};

// ── In-Memory State Singleton ─────────────────────────────────────────────

class MockDatabaseState {
  collections: Map<string, Map<string, any>> = new Map();
  rtdbTree: Record<string, any> = {};
  autoId = 100;

  constructor() {
    this.reset();
  }

  reset() {
    this.collections.clear();
    const fleetMap = new Map<string, any>();
    INITIAL_FLEET.forEach(f => fleetMap.set(f.id, { ...f }));
    this.collections.set('fleet', fleetMap);

    const userMap = new Map<string, any>();
    INITIAL_USERS.forEach(u => userMap.set(u.id, { ...u }));
    this.collections.set('users', userMap);

    const rentalMap = new Map<string, any>();
    INITIAL_RENTALS.forEach(r => rentalMap.set(r.id, { ...r }));
    this.collections.set('rentals', rentalMap);

    this.rtdbTree = {
      telemetry: { ...INITIAL_TELEMETRY },
    };
  }

  getCollection(name: string): Map<string, any> {
    if (!this.collections.has(name)) {
      this.collections.set(name, new Map());
    }
    return this.collections.get(name)!;
  }
}

// Keep across hot-reloads in Node global
const globalForMock = global as unknown as { __mockState?: MockDatabaseState };
export const mockState = globalForMock.__mockState || new MockDatabaseState();
if (process.env.NODE_ENV !== 'production') globalForMock.__mockState = mockState;

// ── Mock Timestamp wrapper ────────────────────────────────────────────────

function isFieldValue(v: any): boolean {
  if (!v || typeof v !== 'object') return false;
  const name = v.constructor?.name || '';
  return (
    name === 'FieldValue' ||
    name.includes('Transform') ||
    name.includes('FieldValue') ||
    name.includes('ServerTimestamp') ||
    Boolean(v._methodName)
  );
}

function wrapTimestamp(val: any): any {
  if (isFieldValue(val)) {
    val = new Date();
  }
  if (val && typeof val === 'object' && typeof val.toDate === 'function') {
    return val;
  }
  if (val instanceof Date) {
    return {
      toDate: () => val,
      toMillis: () => val.getTime(),
      toISOString: () => val.toISOString(),
    };
  }
  if (typeof val === 'string' && !isNaN(Date.parse(val))) {
    const d = new Date(val);
    return {
      toDate: () => d,
      toMillis: () => d.getTime(),
      toISOString: () => d.toISOString(),
    };
  }
  if (val && typeof val === 'object' && ('_seconds' in val || 'seconds' in val)) {
    const sec = val._seconds ?? val.seconds;
    const d = new Date(sec * 1000);
    return {
      toDate: () => d,
      toMillis: () => d.getTime(),
      toISOString: () => d.toISOString(),
    };
  }
  const now = new Date();
  return {
    toDate: () => now,
    toMillis: () => now.getTime(),
    toISOString: () => now.toISOString(),
  };
}

function normalizeDocData(raw: any) {
  if (!raw || typeof raw !== 'object') return raw;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (isFieldValue(v) || k === 'startTime' || k === 'createdAt' || k === 'endTime') {
      out[k] = v == null ? null : wrapTimestamp(v);
    } else if (v instanceof Date) {
      out[k] = wrapTimestamp(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ── Mock Firestore Implementation ─────────────────────────────────────────

export class MockDocSnapshot {
  constructor(public id: string, private _data: any) {}
  get exists(): boolean {
    return this._data !== undefined && this._data !== null;
  }
  data(): any {
    return this._data ? normalizeDocData(this._data) : undefined;
  }
}

export class MockQuerySnapshot {
  constructor(public docs: MockDocSnapshot[]) {}
  get empty(): boolean {
    return this.docs.length === 0;
  }
  get size(): number {
    return this.docs.length;
  }
}

export class MockDocRef {
  constructor(public collectionName: string, public id: string) {}

  async get(): Promise<MockDocSnapshot> {
    const col = mockState.getCollection(this.collectionName);
    const data = col.get(this.id);
    return new MockDocSnapshot(this.id, data ? { ...data } : undefined);
  }

  async set(data: any): Promise<void> {
    const col = mockState.getCollection(this.collectionName);
    col.set(this.id, { ...normalizeDocData(data), id: this.id });
  }

  async update(data: any): Promise<void> {
    const col = mockState.getCollection(this.collectionName);
    const existing = col.get(this.id);
    if (!existing) {
      throw Object.assign(new Error(`Document ${this.id} not found`), { code: 404 });
    }
    col.set(this.id, { ...existing, ...normalizeDocData(data) });
  }

  async delete(): Promise<void> {
    const col = mockState.getCollection(this.collectionName);
    col.delete(this.id);
  }
}

export class MockQuery {
  constructor(
    public collectionName: string,
    private filters: Array<{ field: string; op: string; val: any }> = [],
    private sortOrder?: { field: string; dir: 'asc' | 'desc' },
    private limitCount?: number
  ) {}

  where(field: string, op: string, val: any): MockQuery {
    return new MockQuery(
      this.collectionName,
      [...this.filters, { field, op, val }],
      this.sortOrder,
      this.limitCount
    );
  }

  orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): MockQuery {
    return new MockQuery(this.collectionName, this.filters, { field, dir }, this.limitCount);
  }

  limit(n: number): MockQuery {
    return new MockQuery(this.collectionName, this.filters, this.sortOrder, n);
  }

  async get(): Promise<MockQuerySnapshot> {
    const col = mockState.getCollection(this.collectionName);
    let items = Array.from(col.values()).map(d => ({ ...d }));

    // Apply filters
    for (const f of this.filters) {
      items = items.filter(item => {
        const itemVal = item[f.field];
        if (f.op === '==') return String(itemVal) === String(f.val);
        if (f.op === '!=') return String(itemVal) !== String(f.val);
        if (f.op === '>') return itemVal > f.val;
        if (f.op === '>=') return itemVal >= f.val;
        if (f.op === '<') return itemVal < f.val;
        if (f.op === '<=') return itemVal <= f.val;
        return true;
      });
    }

    // Apply sorting
    if (this.sortOrder) {
      const { field, dir } = this.sortOrder;
      items.sort((a, b) => {
        let va = a[field];
        let vb = b[field];
        if (va && typeof va.toDate === 'function') va = va.toDate().getTime();
        if (vb && typeof vb.toDate === 'function') vb = vb.toDate().getTime();
        if (va instanceof Date) va = va.getTime();
        if (vb instanceof Date) vb = vb.getTime();
        if (va == null) return 1;
        if (vb == null) return -1;
        if (va < vb) return dir === 'asc' ? -1 : 1;
        if (va > vb) return dir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Apply limit
    if (this.limitCount && this.limitCount > 0) {
      items = items.slice(0, this.limitCount);
    }

    const docs = items.map(d => new MockDocSnapshot(String(d.id), d));
    return new MockQuerySnapshot(docs);
  }
}

export class MockCollection extends MockQuery {
  doc(id?: string): MockDocRef {
    const docId = id ? String(id) : String(++mockState.autoId);
    return new MockDocRef(this.collectionName, docId);
  }

  async add(data: any): Promise<MockDocRef> {
    const col = mockState.getCollection(this.collectionName);
    const newId = String(++mockState.autoId);
    const docData = { ...normalizeDocData(data), id: newId };
    col.set(newId, docData);
    return new MockDocRef(this.collectionName, newId);
  }
}

export class MockFirestore {
  collection(name: string): MockCollection {
    return new MockCollection(name);
  }

  async runTransaction<T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> {
    const tx = {
      get: async (ref: MockDocRef) => ref.get(),
      set: (ref: MockDocRef, data: any) => ref.set(data),
      update: (ref: MockDocRef, data: any) => ref.update(data),
      delete: (ref: MockDocRef) => ref.delete(),
    };
    return await updateFunction(tx);
  }
}

// ── Mock Realtime Database Implementation ─────────────────────────────────

export class MockRtdbRef {
  constructor(private path: string) {}

  private getKeys(): string[] {
    return this.path.split('/').filter(Boolean);
  }

  private getNode(): any {
    const keys = this.getKeys();
    let current: any = mockState.rtdbTree;
    for (const key of keys) {
      if (!current || typeof current !== 'object') return undefined;
      current = current[key];
    }
    return current;
  }

  async set(val: any): Promise<void> {
    const keys = this.getKeys();
    if (keys.length === 0) {
      mockState.rtdbTree = val;
      return;
    }
    let current: any = mockState.rtdbTree;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    current[keys[keys.length - 1]] = val;
  }

  async get(): Promise<{ exists: () => boolean; val: () => any }> {
    const val = this.getNode();
    return {
      exists: () => val !== undefined && val !== null,
      val: () => (val !== undefined ? JSON.parse(JSON.stringify(val)) : null),
    };
  }

  async once(_event: string): Promise<{ exists: () => boolean; val: () => any }> {
    return this.get();
  }
}

export class MockRealtimeDatabase {
  ref(path = '/'): MockRtdbRef {
    return new MockRtdbRef(path);
  }
}

const mockFirestoreInstance = new MockFirestore();
const mockRtdbInstance = new MockRealtimeDatabase();

export function getMockFirestore(): any {
  return mockFirestoreInstance;
}

export function getMockDatabase(): any {
  return mockRtdbInstance;
}
