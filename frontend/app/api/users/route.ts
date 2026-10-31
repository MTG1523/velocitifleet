import { NextRequest, NextResponse } from 'next/server';
import { rtdbGet, rtdbPut } from '@/lib/firebase-rtdb';

export interface UserItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  createdAt: string;
}

const DEFAULT_USERS: UserItem[] = [
  { id: '1', name: 'Mokaanth D (Master Admin)', email: 'mokaanth.dev@gmail.com', phone: '+91 98400 12345', role: 'ADMIN', createdAt: new Date().toISOString() },
  { id: '2', name: 'Alice Johnson (Fleet Director)', email: 'alice@velocitifleet.com', phone: '+1 555 0101', role: 'ADMIN', createdAt: new Date().toISOString() },
  { id: '3', name: 'Carlos Diaz (Senior Chauffeur)', email: 'carlos.diaz@velocitifleet.com', phone: '+1 555 0103', role: 'DRIVER', createdAt: new Date().toISOString() },
  { id: '4', name: 'Alexander Vance (VIP Elite)', email: 'alexander@velocitifleet.com', phone: '+1 555 0102', role: 'CUSTOMER', createdAt: new Date().toISOString() },
  { id: '5', name: 'Eve Wilson (VIP Chauffeur)', email: 'eve@velocitifleet.com', phone: '+1 555 0105', role: 'DRIVER', createdAt: new Date().toISOString() },
];

/** GET /api/users — all users directly from Firebase */
export async function GET() {
  try {
    const raw = await rtdbGet<Record<string, any>>('users');
    if (raw && typeof raw === 'object') {
      const list = (Array.isArray(raw) ? raw.filter(Boolean) : Object.values(raw).filter(Boolean)) as UserItem[];
      if (list.length > 0) {
        return NextResponse.json(list);
      }
    }

    // Auto-seed initial users in Firebase
    const seedMap: Record<string, UserItem> = {};
    DEFAULT_USERS.forEach(u => { seedMap[u.id] = u; });
    await rtdbPut('users', seedMap);
    return NextResponse.json(DEFAULT_USERS);
  } catch (err) {
    console.error('[GET /api/users]', err);
    return NextResponse.json(DEFAULT_USERS);
  }
}

/** POST /api/users — create a user directly in Firebase */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = body.id || `user_${Date.now()}`;
    const user: UserItem = {
      id,
      name: body.name || 'Member',
      email: body.email || '',
      phone: body.phone || '+1 555 0199',
      role: body.role || 'CUSTOMER',
      createdAt: new Date().toISOString(),
    };

    await rtdbPut(`users/${id}`, user);
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    console.error('[POST /api/users]', err);
    return NextResponse.json({ error: 'Failed to create user in Firebase' }, { status: 500 });
  }
}
