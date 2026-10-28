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
  return initializeApp({
    apiKey:            firebaseConfig.apiKey || 'demo-api-key',
    authDomain:        firebaseConfig.authDomain || 'velocitifleet-demo.firebaseapp.com',
    projectId:         firebaseConfig.projectId || 'velocitifleet-demo',
    storageBucket:     firebaseConfig.storageBucket || 'velocitifleet-demo.appspot.com',
    messagingSenderId: firebaseConfig.messagingSenderId || '1234567890',
    appId:             firebaseConfig.appId || '1:1234567890:web:demo',
    databaseURL:       firebaseConfig.databaseURL || 'https://velocitifleet-demo-default-rtdb.firebaseio.com',
  });
}

function initClientDb(): Database {
  const app = getClientApp();
  const dbUrl = firebaseConfig.databaseURL || 'https://velocitifleet-demo-default-rtdb.firebaseio.com';
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
