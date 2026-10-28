/**
 * firebase-admin.ts — Server-only Firebase Admin SDK singleton.
 *
 * Uses firebase-admin v12 modular API when valid credentials are provided.
 * When running in local development without GCP credentials, seamlessly falls back
 * to the in-memory mock store (mock-store.ts) so the app works 100% out of the box.
 *
 * ⚠️  NEVER import this file from client components or hooks.
 */

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore as _getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getDatabase as _getDatabase, type Database } from 'firebase-admin/database';
import { getMockFirestore, getMockDatabase } from './mock-store';

/**
 * Checks whether valid Firebase credentials have been supplied in environment variables.
 */
export function isFirebaseConfigured(): boolean {
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!rawKey || !projectId || !clientEmail) return false;
  if (rawKey.includes('PASTE_YOUR_KEY_HERE') || rawKey.includes('...')) return false;
  if (projectId === 'your_project_id' || projectId === 'demo-project') return false;
  if (clientEmail.includes('your_project')) return false;

  return true;
}

function getAdminApp(): App | null {
  if (!isFirebaseConfigured()) {
    return null;
  }

  if (getApps().length > 0) {
    return getApps()[0];
  }

  const rawKey = process.env.FIREBASE_PRIVATE_KEY!;
  const privateKey = rawKey.replace(/\\n/g, '\n');
  const projectId = process.env.FIREBASE_PROJECT_ID!;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!;

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
}

/** Server-side Firestore instance (Admin SDK or in-memory fallback). */
export function getFirestore(): Firestore {
  const app = getAdminApp();
  if (!app) {
    return getMockFirestore();
  }
  try {
    return _getFirestore(app);
  } catch (err) {
    console.warn('[firebase-admin] Falling back to mock Firestore:', err);
    return getMockFirestore();
  }
}

/** Server-side Realtime Database instance (Admin SDK or in-memory fallback). */
export function getDatabase(): Database {
  const app = getAdminApp();
  if (!app) {
    return getMockDatabase();
  }
  try {
    return _getDatabase(app);
  } catch (err) {
    console.warn('[firebase-admin] Falling back to mock RTDB:', err);
    return getMockDatabase();
  }
}
