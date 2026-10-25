import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export interface UserItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  createdAt: string;
}

function docToUser(doc: FirebaseFirestore.DocumentSnapshot): UserItem {
  const d = doc.data()!;
  return {
    id:        doc.id,
    name:      d.name,
    email:     d.email,
    phone:     d.phone,
    role:      d.role,
    createdAt: d.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
  };
}

/** GET /api/users — all users */
export async function GET() {
  try {
    const db   = getFirestore();
    const snap = await db.collection('users').orderBy('createdAt', 'asc').get();
    return NextResponse.json(snap.docs.map(docToUser));
  } catch (err) {
    console.error('[GET /api/users]', err);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

/** POST /api/users — create a user */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db   = getFirestore();
    const ref  = await db.collection('users').add({
      name:      body.name,
      email:     body.email,
      phone:     body.phone,
      role:      body.role ?? 'CUSTOMER',
      createdAt: FieldValue.serverTimestamp(),
    });
    const created = await ref.get();
    return NextResponse.json(docToUser(created), { status: 201 });
  } catch (err) {
    console.error('[POST /api/users]', err);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
