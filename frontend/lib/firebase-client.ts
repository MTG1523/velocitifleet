'use client';

/**
 * firebase-client.ts — Client-side Firebase SDK singleton.
 *
 * Initialises the Firebase app once using getApps() guard.
 * Exports clientDb (Realtime Database) for use in browser hooks.
 *
 * ⚠️  Only import this file from client components / hooks ('use client').
 */

import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL:       process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

function getClientApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApps()[0];
  }
  return initializeApp(firebaseConfig);
}

/** Client-side Firebase Realtime Database instance. */
export const clientDb: Database = getDatabase(getClientApp());
