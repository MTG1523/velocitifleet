'use client';

/**
 * firebase-client.ts — Client-side Firebase SDK singleton.
 *
 * Initialises the Firebase app once using getApps() guard.
 * Exports clientDb (Realtime Database), clientAuth (Firebase Auth),
 * and googleProvider for Google Sign-In.
 *
 * ⚠️  Only import this file from client components / hooks ('use client').
 */

import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyB9g8If5k_1jiuFGmAWutclIsN4r7deikg',
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'velocitifleet.firebaseapp.com',
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'velocitifleet',
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'velocitifleet.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '35960102430',
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:35960102430:web:748da6bf6cdf83b012980f',
  databaseURL:       process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'https://velocitifleet-default-rtdb.firebaseio.com',
};

export function isFirebaseAuthConfigured(): boolean {
  const key = firebaseConfig.apiKey;
  return Boolean(
    key &&
    key.startsWith('AIza') &&
    key.length >= 30 &&
    !key.toLowerCase().includes('your') &&
    !key.toLowerCase().includes('placeholder')
  );
}

function getClientApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApps()[0];
  }
  return initializeApp(firebaseConfig);
}

function initClientDb(): Database {
  const app = getClientApp();
  const dbUrl = firebaseConfig.databaseURL;
  try {
    return getDatabase(app, dbUrl);
  } catch {
    return getDatabase(app);
  }
}

/** Client-side Firebase Realtime Database instance. */
export const clientDb: Database = initClientDb();

/** Client-side Firebase Auth instance (null if API key unconfigured). */
export const clientAuth: Auth | null = isFirebaseAuthConfigured()
  ? getAuth(getClientApp())
  : null;

/** Google Auth Provider for popup sign-in. */
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
