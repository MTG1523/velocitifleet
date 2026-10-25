/**
 * VelocitiFleet GPS Simulator — simulate.js
 *
 * Simulates a single vehicle's 4G LTE telemetry module sending live GPS
 * coordinates to Firebase Realtime Database at /telemetry/{vehicleId}.
 *
 * Usage:
 *   node simulate.js [vehicleId] [startLat] [startLng]
 *
 * Examples:
 *   node simulate.js           # Vehicle 1, San Francisco
 *   node simulate.js 4         # Vehicle 4, same location
 *   node simulate.js 1 51.5 -0.12  # Vehicle 1, London
 */

require('dotenv').config();
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

// ── Firebase Admin Init ───────────────────────────────────────
function getAdminDatabase() {
  if (getApps().length === 0) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined;

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const databaseURL = process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

    if (!databaseURL) {
      console.warn('⚠️ WARNING: FIREBASE_DATABASE_URL is not set in environment or .env');
    }

    const appOptions = { databaseURL };
    if (projectId && clientEmail && privateKey) {
      appOptions.credential = cert({ projectId, clientEmail, privateKey });
    }

    initializeApp(appOptions);
  }
  return getDatabase();
}

// ── Configuration ─────────────────────────────────────────────
const VEHICLE_ID        = parseInt(process.argv[2]) || 1;
const UPDATE_INTERVAL   = 2000;   // ms between GPS pings
const DATABASE_URL      = process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || '(default)';

// Starting position (San Francisco by default)
let lat     = parseFloat(process.argv[3]) || 37.774929;
let lng     = parseFloat(process.argv[4]) || -122.419416;
let heading = Math.floor(Math.random() * 360);
let speed   = 30 + Math.random() * 20; // km/h

// ── Utility Functions ─────────────────────────────────────────

/** Generate a smooth next GPS position using realistic movement. */
function nextPosition() {
  const headingDelta = (Math.random() - 0.5) * 15;
  heading = (heading + headingDelta + 360) % 360;

  const speedDelta = (Math.random() - 0.5) * 5;
  speed = Math.max(5, Math.min(80, speed + speedDelta));

  // ~1 degree lat/lng ≈ 111 km → convert speed (km/h) to degrees per 2-sec step
  const distanceKmPerStep = (speed / 3600) * (UPDATE_INTERVAL / 1000);
  const headingRad = (heading * Math.PI) / 180;

  lat += (distanceKmPerStep / 111) * Math.cos(headingRad);
  lng += (distanceKmPerStep / (111 * Math.cos((lat * Math.PI) / 180))) * Math.sin(headingRad);

  return {
    fleetId:   VEHICLE_ID,
    latitude:  parseFloat(lat.toFixed(6)),
    longitude: parseFloat(lng.toFixed(6)),
    speed:     parseFloat(speed.toFixed(1)),
    heading:   Math.round(heading),
    updatedAt: Date.now(),
  };
}

/** Format timestamp for console display. */
function timestamp() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

// ── Realtime Database Telemetry Loop ──────────────────────────

let intervalId = null;

function startSimulation() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   🚗  VelocitiFleet GPS Simulator (RTDB)     ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`📡  Target:    Firebase RTDB /telemetry/${VEHICLE_ID}`);
  console.log(`🌐  DB URL:    ${DATABASE_URL}`);
  console.log(`🚙  Vehicle:   ID=${VEHICLE_ID}`);
  console.log(`📍  Start:     lat=${lat.toFixed(6)}, lng=${lng.toFixed(6)}`);
  console.log(`⏱   Interval:  ${UPDATE_INTERVAL}ms\n`);

  let db;
  try {
    db = getAdminDatabase();
  } catch (err) {
    console.error(`[${timestamp()}] ❌ Failed to initialize Firebase Admin:`, err.message);
    return;
  }

  // Send initial position immediately
  const initialData = nextPosition();
  db.ref(`/telemetry/${VEHICLE_ID}`).set(initialData)
    .then(() => {
      console.log(`[${timestamp()}] 📍 INIT   lat=${initialData.latitude}, lng=${initialData.longitude}, speed=${initialData.speed}km/h`);
    })
    .catch((err) => {
      console.error(`[${timestamp()}] ❌ RTDB Error on INIT:`, err.message);
    });

  // Then send on interval
  intervalId = setInterval(() => {
    const data = nextPosition();
    db.ref(`/telemetry/${VEHICLE_ID}`).set(data)
      .then(() => {
        console.log(
          `[${timestamp()}] 📡 PING   lat=${data.latitude}, lng=${data.longitude}, ` +
          `speed=${data.speed}km/h, hdg=${data.heading}°`
        );
      })
      .catch((err) => {
        console.error(`[${timestamp()}] ❌ RTDB Error:`, err.message);
      });
  }, UPDATE_INTERVAL);
}

// ── Handle graceful shutdown ──────────────────────────────────
process.on('SIGINT', () => {
  console.log('\n🛑 Simulator stopped.');
  if (intervalId) clearInterval(intervalId);
  process.exit(0);
});

startSimulation();
