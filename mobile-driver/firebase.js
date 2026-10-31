/**
 * firebase.js — Firebase client singleton for the VelocitiFleet mobile driver app.
 *
 * Initialises Firebase once using getApps() guard.
 * Exports:
 *   - db       → Firebase Realtime Database instance
 *   - fbRef    → helper to get a database ref by path
 *
 * All credentials here are the same public Firebase config from the web app
 * (the same Firebase project). These are safe to embed in mobile apps.
 *
 * ─────────────────────────────────────────────────
 * RTDB Path Structure:
 *   /telemetry/{fleetId}           → latest GPS ping per vehicle
 *   /telemetry_stream              → rolling last-50 pings array
 *   /dispatch/{fleetId}            → web→app commands (assignment, etc.)
 *   /driver_presence/{driverEmail} → driver online status heartbeat
 * ─────────────────────────────────────────────────
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref } from 'firebase/database';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            'AIzaSyB9g8If5k_1jiuFGmAWutclIsN4r7deikg',
  authDomain:        'velocitifleet.firebaseapp.com',
  projectId:         'velocitifleet',
  storageBucket:     'velocitifleet.firebasestorage.app',
  messagingSenderId: '35960102430',
  appId:             '1:35960102430:web:748da6bf6cdf83b012980f',
  databaseURL:       'https://velocitifleet-default-rtdb.firebaseio.com',
};

// Singleton initialisation
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

/** Firebase Realtime Database instance */
export const db = getDatabase(app);

/** Firebase Auth instance */
export const auth = getAuth(app);

/** Google Auth Provider */
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/** Helper: get a database ref by path string */
export const fbRef = (path) => ref(db, path);

export default app;

