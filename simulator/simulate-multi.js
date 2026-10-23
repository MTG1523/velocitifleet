/**
 * VelocitiFleet Multi-Vehicle GPS Simulator — simulate-multi.js
 *
 * Simulates multiple vehicles simultaneously by spawning one WebSocket
 * connection per vehicle. Great for testing the fleet map view.
 *
 * Usage: node simulate-multi.js
 */

const WebSocket = require('ws');

const WS_URL         = process.env.WS_URL || 'ws://localhost:8080/ws/location';
const UPDATE_INTERVAL = 2000;

// Configure which vehicles to simulate (id + starting coordinates)
const VEHICLES = [
  { id: 1, lat: 37.774929, lng: -122.419416, heading: 45  },
  { id: 3, lat: 37.785834, lng: -122.400747, heading: 180 },
  { id: 5, lat: 37.769234, lng: -122.430512, heading: 270 },
  { id: 7, lat: 37.758000, lng: -122.410000, heading: 90  },
];

function timestamp() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function simulateVehicle(vehicle) {
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
    };
  }

  function connect() {
    const ws = new WebSocket(WS_URL);

    ws.on('open', () => {
      console.log(`[${timestamp()}] [V${id}] ✅ Connected`);

      const intervalId = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) { clearInterval(intervalId); return; }
        const data = nextPos();
        ws.send(JSON.stringify(data));
        console.log(`[${timestamp()}] [V${id}] 📡 lat=${data.latitude}, lng=${data.longitude}, spd=${data.speed}km/h`);
      }, UPDATE_INTERVAL);

      ws.on('close', () => {
        clearInterval(intervalId);
        console.log(`[${timestamp()}] [V${id}] 🔌 Disconnected. Reconnecting in 5s...`);
        setTimeout(connect, 5000);
      });
    });

    ws.on('error', (err) => {
      console.error(`[${timestamp()}] [V${id}] ❌ ${err.message}`);
    });
  }

  // Stagger connection start times to avoid thundering herd
  setTimeout(connect, id * 300);
}

console.log('╔═══════════════════════════════════════════════╗');
console.log('║  🚗🚗🚗  VelocitiFleet Multi-Vehicle Sim      ║');
console.log('╚═══════════════════════════════════════════════╝');
console.log(`Simulating ${VEHICLES.length} vehicles on ${WS_URL}\n`);

VEHICLES.forEach(simulateVehicle);

process.on('SIGINT', () => {
  console.log('\n🛑 Simulation stopped.');
  process.exit(0);
});
