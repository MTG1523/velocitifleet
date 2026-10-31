import { NextRequest, NextResponse } from 'next/server';
import { rtdbGet, rtdbPatch, rtdbPut } from '@/lib/firebase-rtdb';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uid, email, name, photoURL, phone, role } = body;

    if (!email && !uid) {
      return NextResponse.json({ error: 'Missing email or uid' }, { status: 400 });
    }

    const userId = uid || `user_${Date.now()}`;
    const userRole = role || 'CUSTOMER';

    const existing = await rtdbGet<any>(`users/${userId}`);

    const userData = {
      id: userId,
      uid: userId,
      name: name || existing?.name || (email ? email.split('@')[0] : 'Member'),
      email: email || existing?.email || '',
      phone: phone || existing?.phone || '+1 555 0199',
      role: userRole,
      photoURL: photoURL || existing?.photoURL || '',
      provider: 'google',
      tier: userRole === 'ADMIN' ? 'Fleet Operations Admin' : userRole === 'CUSTOMER' ? 'Black Gold Elite' : 'Senior Chauffeur',
      lastLoginAt: new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    if (existing) {
      await rtdbPatch(`users/${userId}`, userData);
    } else {
      await rtdbPut(`users/${userId}`, userData);
    }

    return NextResponse.json(userData);
  } catch (err: unknown) {
    console.error('[POST /api/users/sync]', err);
    return NextResponse.json(
      { error: 'Failed to sync user with Firebase', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
