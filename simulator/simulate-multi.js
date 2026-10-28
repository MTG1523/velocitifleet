/**
 * VelocitiFleet Multi-Vehicle GPS Simulator — simulate-multi.js
 *
 * Simulates multiple vehicles simultaneously by publishing updates directly
 * to Firebase Realtime Database at /telemetry/{vehicleId}.
 *
 * Usage: node simulate-multi.js
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

    const appOptions = { databaseURL };
    if (projectId && clientEmail && privateKey) {
      appOptions.credential = cert({ projectId, clientEmail, privateKey });
    }

    initializeApp(appOptions);
  }
  return getDatabase();
}

const UPDATE_INTERVAL = 2000;
const DATABASE_URL    = process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || '(default)';

// Configure which vehicles to simulate (Chennai hubs: Marina, Anna Nagar, Airport, ECR)
const VEHICLES = [
  { id: 1, lat: 13.0500, lng: 80.2824, heading: 45  }, // Marina Beach
  { id: 3, lat: 13.0850, lng: 80.2100, heading: 180 }, // Anna Nagar
  { id: 5, lat: 12.9941, lng: 80.1709, heading: 270 }, // Airport
  { id: 7, lat: 12.9830, lng: 80.2594, heading: 90  }, // ECR / Thiruvanmiyur
];

function timestamp() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function simulateVehicle(db, vehicle) {
  let { id, lat, lng, heading } = vehicle;
  let speed = 25 + Math.random() * 20;

  function nextPos() {
    heading = (heading + (Math.random() - 0.5) * 20 + 360) % 360;
    speed   = Math.max(5, Math.min(80, speed + (Math.random() - 0.5) * 5));
    const dist = (speed / 3600) * (UPDATE_INTERVAL / 1000);
    const rad  = (heading * Math.PI) / 180;
    lat += (dist / 111) * Math.cos(rad);
    lng += (dist / (111 * Math.cos((lat * Math.PI) / 180))) * Math.sin(rad);
    return {
      fleetId:   id,
      latitude:  parseFloat(lat.toFixed(6)),
      longitude: parseFloat(lng.toFixed(6)),
      speed:     parseFloat(speed.toFixed(1)),
      heading:   Math.round(heading),
      updatedAt: Date.now(),
    };
  }

  setInterval(() => {
    const data = nextPos();
    db.ref(`/telemetry/${id}`).set(data)
      .then(() => {
        console.log(`[${timestamp()}] [V${id}] 📡 lat=${data.latitude}, lng=${data.longitude}, spd=${data.speed}km/h`);
      })
      .catch((err) => {
        console.error(`[${timestamp()}] [V${id}] ❌ Error: ${err.message}`);
      });
  }, UPDATE_INTERVAL);
}

console.log('╔═══════════════════════════════════════════════╗');
console.log('║  🚗🚗🚗  VelocitiFleet Multi-Vehicle Sim (RTDB)║');
console.log('╚═══════════════════════════════════════════════╝');
console.log(`Simulating ${VEHICLES.length} vehicles on ${DATABASE_URL}\n`);

let db;
try {
  db = getAdminDatabase();
  VEHICLES.forEach(v => simulateVehicle(db, v));
} catch (err) {
  console.error('❌ Failed to initialize Firebase simulator:', err.message);
}

process.on('SIGINT', () => {
  console.log('\n🛑 Simulation stopped.');
  process.exit(0);
});
