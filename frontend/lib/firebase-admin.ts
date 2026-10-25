/**
 * firebase-admin.ts — Server-only Firebase Admin SDK singleton.
 *
 * Uses firebase-admin v12 modular API:
 *   initializeApp / getApps / cert from 'firebase-admin/app'
 *   getFirestore               from 'firebase-admin/firestore'
 *   getDatabase                from 'firebase-admin/database'
 *
 * ⚠️  NEVER import this file from client components or hooks.
 */

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore as _getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getDatabase as _getDatabase, type Database } from 'firebase-admin/database';

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = rawKey && !rawKey.includes('PASTE_YOUR_KEY_HERE')
    ? rawKey.replace(/\\n/g, '\n')
    : undefined;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    });
  }

  // Fallback initialization if credentials haven't been provided yet
  return initializeApp({
    projectId: projectId || 'demo-project',
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
}

/** Server-side Firestore instance (Admin SDK). */
export function getFirestore(): Firestore {
  return _getFirestore(getAdminApp());
}

/** Server-side Realtime Database instance (Admin SDK). */
export function getDatabase(): Database {
  return _getDatabase(getAdminApp());
}
