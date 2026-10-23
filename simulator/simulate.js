/**
 * VelocitiFleet GPS Simulator — simulate.js
 *
 * Simulates a single vehicle's 4G LTE telemetry module sending live GPS
 * coordinates to the Spring Boot WebSocket server at /ws/location.
 *
 * Usage:
 *   npm install
 *   node simulate.js [vehicleId] [startLat] [startLng]
 *
 * Examples:
 *   node simulate.js           # Vehicle 1, San Francisco
 *   node simulate.js 4         # Vehicle 4, same location
 *   node simulate.js 1 51.5 -0.12  # Vehicle 1, London
 */

const WebSocket = require('ws');

// ── Configuration ─────────────────────────────────────────────
const WS_URL            = process.env.WS_URL || 'ws://localhost:8080/ws/location';
const VEHICLE_ID        = parseInt(process.argv[2]) || 1;
const RECONNECT_DELAY   = 5000;   // ms before reconnect on disconnect
const UPDATE_INTERVAL   = 2000;   // ms between GPS pings

// Starting position (San Francisco by default)
let lat     = parseFloat(process.argv[3]) || 37.774929;
let lng     = parseFloat(process.argv[4]) || -122.419416;
let heading = Math.floor(Math.random() * 360);
let speed   = 30 + Math.random() * 20; // km/h

// ── Utility Functions ─────────────────────────────────────────

/** Generate a smooth next GPS position using realistic movement. */
function nextPosition() {
  // Gradually change heading (smooth turning)
  const headingDelta = (Math.random() - 0.5) * 15;
  heading = (heading + headingDelta + 360) % 360;

  // Gradually change speed (smooth acceleration)
  const speedDelta = (Math.random() - 0.5) * 5;
  speed = Math.max(5, Math.min(80, speed + speedDelta));

  // Move in the current heading direction
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
  };
}

/** Format timestamp for console display. */
function timestamp() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

// ── WebSocket Connection ──────────────────────────────────────

let intervalId = null;

function connect() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   🚗  VelocitiFleet GPS Simulator             ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`📡  Server:    ${WS_URL}`);
  console.log(`🚙  Vehicle:   ID=${VEHICLE_ID}`);
  console.log(`📍  Start:     lat=${lat.toFixed(6)}, lng=${lng.toFixed(6)}`);
  console.log(`⏱   Interval:  ${UPDATE_INTERVAL}ms\n`);

  const ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    console.log(`[${timestamp()}] ✅ Connected to ${WS_URL}`);

    // Send initial position immediately
    const data = nextPosition();
    ws.send(JSON.stringify(data));
    console.log(`[${timestamp()}] 📍 INIT   lat=${data.latitude}, lng=${data.longitude}, speed=${data.speed}km/h`);

    // Then send on the interval
    intervalId = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const data = nextPosition();
      const msg  = JSON.stringify(data);
      ws.send(msg);
      console.log(
        `[${timestamp()}] 📡 PING   lat=${data.latitude}, lng=${data.longitude}, ` +
        `speed=${data.speed}km/h, hdg=${data.heading}°`
      );
    }, UPDATE_INTERVAL);
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'ERROR') {
        console.error(`[${timestamp()}] ❌ Server error: ${msg.message}`);
      } else {
        console.log(`[${timestamp()}] 📨 Server: ${raw.toString().substring(0, 80)}...`);
      }
    } catch {
      console.log(`[${timestamp()}] 📨 Server: ${raw.toString()}`);
    }
  });

  ws.on('close', (code, reason) => {
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    console.log(`[${timestamp()}] 🔌 Disconnected (${code}: ${reason}). Reconnecting in ${RECONNECT_DELAY / 1000}s...`);
    setTimeout(connect, RECONNECT_DELAY);
  });

  ws.on('error', (err) => {
    console.error(`[${timestamp()}] ❌ WebSocket error: ${err.message}`);
  });
}

// ── Handle graceful shutdown ──────────────────────────────────
process.on('SIGINT', () => {
  console.log('\n🛑 Simulator stopped.');
  if (intervalId) clearInterval(intervalId);
  process.exit(0);
});

connect();
