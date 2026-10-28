import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uid, email, name, photoURL, phone } = body;

    if (!email && !uid) {
      return NextResponse.json({ error: 'Missing email or uid' }, { status: 400 });
    }

    const db = getFirestore();
    const usersCol = db.collection('users');

    // Check if user already exists by email or uid
    let existingDoc: FirebaseFirestore.DocumentSnapshot | null = null;
    
    if (email) {
      const snap = await usersCol.where('email', '==', email).limit(1).get();
      if (!snap.empty) {
        existingDoc = snap.docs[0];
      }
    }

    if (!existingDoc && uid) {
      const snap = await usersCol.where('uid', '==', uid).limit(1).get();
      if (!snap.empty) {
        existingDoc = snap.docs[0];
      }
    }

    if (existingDoc) {
      // User already exists in backend, update any new info
      const current = existingDoc.data()!;
      const updateData: Record<string, any> = {
        lastLoginAt: FieldValue.serverTimestamp(),
      };
      if (name && !current.name) updateData.name = name;
      if (photoURL && !current.photoURL) updateData.photoURL = photoURL;
      if (uid && !current.uid) updateData.uid = uid;

      await existingDoc.ref.update(updateData);
      const updated = await existingDoc.ref.get();
      const d = updated.data()!;

      return NextResponse.json({
        id: updated.id,
        uid: d.uid || uid,
        name: d.name || name || 'Executive Member',
        email: d.email || email,
        phone: d.phone || phone || '+1 (555) 0199',
        role: d.role || 'EXECUTIVE_VIP',
        photoURL: d.photoURL || photoURL || null,
        provider: 'google',
        createdAt: d.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      });
    }

    // Create a new backend user profile for this Google / authenticated account
    const newUserData = {
      uid: uid || `usr_${Date.now()}`,
      name: name || (email ? email.split('@')[0] : 'Executive Client'),
      email: email || '',
      phone: phone || '+1 (555) 0199',
      role: 'EXECUTIVE_VIP',
      photoURL: photoURL || null,
      provider: 'google',
      tier: 'Black Gold Elite',
      createdAt: FieldValue.serverTimestamp(),
      lastLoginAt: FieldValue.serverTimestamp(),
    };

    const docRef = await usersCol.add(newUserData);
    const created = await docRef.get();
    const d = created.data()!;

    return NextResponse.json({
      id: docRef.id,
      uid: d.uid,
      name: d.name,
      email: d.email,
      phone: d.phone,
      role: d.role,
      photoURL: d.photoURL,
      tier: d.tier,
      provider: 'google',
      createdAt: new Date().toISOString(),
    }, { status: 201 });
  } catch (err: unknown) {
    console.error('[POST /api/users/sync]', err);
    return NextResponse.json(
      { error: 'Failed to sync user with backend', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
