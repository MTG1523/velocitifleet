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

  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  return initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
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
