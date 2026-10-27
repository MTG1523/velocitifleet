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
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL:       process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

export function isFirebaseAuthConfigured(): boolean {
  const key = firebaseConfig.apiKey;
  return Boolean(
    key &&
    key.length > 10 &&
    !key.includes('your-') &&
    !key.includes('placeholder')
  );
}

function getClientApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApps()[0];
  }
  return initializeApp(firebaseConfig);
}

/** Client-side Firebase Realtime Database instance. */
export const clientDb: Database = getDatabase(getClientApp());

/** Client-side Firebase Auth instance (null if API key unconfigured). */
export const clientAuth: Auth | null = isFirebaseAuthConfigured()
  ? getAuth(getClientApp())
  : null;

/** Google Auth Provider for popup sign-in. */
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
