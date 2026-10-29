'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

// Dynamically import the dual-marker driver guidance map (Leaflet requires window)
const DriverVehicleMap = dynamic(() => import('@/components/DriverVehicleMap'), {
  ssr: false,
  loading: () => (
    <div
      className="loading-center"
      style={{
        height: '280px',
        background: '#0d1526',
        borderRadius: '16px',
        border: '1px solid rgba(212,175,55,0.2)',
      }}
    >
      <div className="spinner" />
      <span>Booting Driver Guidance Radar...</span>
    </div>
  ),
});

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

interface FleetVehicle {
  id: number;
  make: string;
  model: string;
  type: string;
  registration: string;
  status: string;
  year?: number;
  dailyRate?: number;
}

interface TelemetryPoint {
  fleetId: number;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  updatedAt?: number;
}

// Haversine distance and initial bearing calculation
function calculateDistanceAndBearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  const bearing = ((θ * 180) / Math.PI + 360) % 360;

  return { distance, bearing };
}

// Cardinal direction from bearing
function getCompassDirection(bearing: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}

export default function DriverPage() {
  const { user } = useAuth();
  const [fleet, setFleet] = useState<FleetVehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number>(1);
  const [vehiclePositions, setVehiclePositions] = useState<Record<number, TelemetryPoint>>({});

  // Driver phone GPS state
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [driverPos, setDriverPos] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
  } | null>(null);

  const [pingsSent, setPingsSent] = useState<number>(0);
  const [lastPingTime, setLastPingTime] = useState<string>('Never');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Simulation mode (for desktop or testing in browser without walking)
  const [simulating, setSimulating] = useState<boolean>(false);

  // Duty and trip state
  const [dutyStatus, setDutyStatus] = useState<'ON_DUTY' | 'EN_ROUTE' | 'ARRIVED' | 'OFF_DUTY'>('ON_DUTY');
  const [tripState, setTripState] = useState<'IDLE' | 'DEPARTED' | 'ARRIVED'>('IDLE');

  const watchIdRef = useRef<number | null>(null);
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // 1. Load Fleet and initial Locations
  const loadFleetAndTelemetry = useCallback(async () => {
    try {
      const [fleetRes, locRes] = await Promise.all([
        fetch(`${API}/fleet`).then((r) => (r.ok ? r.json() : [])),
        fetch(`${API}/locations`).then((r) => (r.ok ? r.json() : {})),
      ]);
      const list = Array.isArray(fleetRes) ? fleetRes : [];
      setFleet(list);
      if (list.length > 0 && !selectedVehicleId) {
        setSelectedVehicleId(list[0].id);
      }
      if (locRes && typeof locRes === 'object') {
        setVehiclePositions(locRes as Record<number, TelemetryPoint>);
      }
    } catch {
      showToast('Error syncing fleet data', 'error');
    }
  }, [selectedVehicleId]);

  useEffect(() => {
    loadFleetAndTelemetry();
    const interval = setInterval(loadFleetAndTelemetry, 8000);
    return () => clearInterval(interval);
  }, [loadFleetAndTelemetry]);

  // Selected vehicle details
  const selectedVehicle = fleet.find((v) => v.id === selectedVehicleId) || fleet[0];
  const vehiclePos = selectedVehicle
    ? vehiclePositions[selectedVehicle.id] || {
        fleetId: selectedVehicle.id,
        latitude: 13.0827,
        longitude: 80.2707,
        speed: 0,
        heading: 0,
      }
    : null;

  // Calculate Distance & Bearing from Driver's Phone to Vehicle
  let distanceInfo = { distance: 0, bearing: 0 };
  if (driverPos && vehiclePos) {
    distanceInfo = calculateDistanceAndBearing(
      driverPos.latitude,
      driverPos.longitude,
      vehiclePos.latitude,
      vehiclePos.longitude
    );
  }

  // 2. Transmit Phone Location to Backend Telemetry
  const broadcastLocation = useCallback(
    async (lat: number, lng: number, speed = 0, heading = 0) => {
      if (!selectedVehicleId) return;
      try {
        const res = await fetch(`${API}/locations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fleetId: selectedVehicleId,
            latitude: lat,
            longitude: lng,
            speed: speed || 0,
            heading: heading || 0,
          }),
        });

        if (res.ok) {
          setPingsSent((c) => c + 1);
          setLastPingTime(new Date().toLocaleTimeString());
        }
      } catch (err) {
        console.error('[broadcastLocation error]', err);
      }
    },
    [selectedVehicleId]
  );

  // 3. Start Geolocation Watch
  const startSharingLocation = () => {
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      showToast('Browser does not support GPS. Enabled test mode.', 'error');
      startSimulation();
      return;
    }

    setIsSharing(true);
    showToast('Broadcasting live phone location to fleet radar 📡', 'success');

    // Haptic feedback
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([40, 60, 40]);
      } catch {}
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy, speed, heading } = pos.coords;
        const currentSpeedKmh = speed != null ? speed * 3.6 : 0;
        const currentHeading = heading != null ? heading : 0;

        setDriverPos({
          latitude,
          longitude,
          accuracy: accuracy || 5,
          speed: currentSpeedKmh,
          heading: currentHeading,
        });

        broadcastLocation(latitude, longitude, currentSpeedKmh, currentHeading);
      },
      (err) => {
        console.warn('Geolocation watch error:', err);
        setGpsError(err.message || 'GPS Signal Unavailable');
        showToast(`GPS Error: ${err.message}. Switched to test simulator.`, 'error');
        // Fallback to simulation mode so testing works anywhere
        startSimulation();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // 4. Stop Geolocation Watch
  const stopSharingLocation = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    setIsSharing(false);
    setSimulating(false);
    showToast('Location broadcasting paused', 'info');
  };

  // 5. Simulator Mode (for testing on desktop / without walking)
  const startSimulation = () => {
    setSimulating(true);
    setIsSharing(true);
    showToast('Simulation Mode: Broadcasting walk to vehicle in Chennai', 'info');

    // Start 250 meters away from vehicle
    let currentLat = (vehiclePos?.latitude || 13.0827) - 0.0022;
    let currentLng = (vehiclePos?.longitude || 80.2707) - 0.0018;

    setDriverPos({
      latitude: currentLat,
      longitude: currentLng,
      accuracy: 6,
      speed: 4.8, // 4.8 km/h walking speed
      heading: 42,
    });
    broadcastLocation(currentLat, currentLng, 4.8, 42);

    if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    simIntervalRef.current = setInterval(() => {
      // Step closer to vehicle
      const targetLat = vehiclePos?.latitude || 13.0827;
      const targetLng = vehiclePos?.longitude || 80.2707;

      currentLat += (targetLat - currentLat) * 0.08;
      currentLng += (targetLng - currentLng) * 0.08;

      setDriverPos({
        latitude: currentLat,
        longitude: currentLng,
        accuracy: 4,
        speed: 5.2,
        heading: 45,
      });

      broadcastLocation(currentLat, currentLng, 5.2, 45);
    }, 2500);
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
      }
    };
  }, []);

  // Format distance
  const formattedDistance =
    distanceInfo.distance > 1000
      ? `${(distanceInfo.distance / 1000).toFixed(2)} km`
      : `${Math.round(distanceInfo.distance)} meters`;

  const estimatedWalkTime = Math.max(1, Math.round(distanceInfo.distance / 80)); // ~80m/min walking speed

  // Open Google Maps walking directions
  const openExternalNavigation = () => {
    if (!vehiclePos) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${vehiclePos.latitude},${vehiclePos.longitude}&travelmode=walking`;
    window.open(url, '_blank');
  };

  // Simulated Beep Horn / Flash lights
  const handleHornFlash = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([100, 50, 100, 50, 200]);
      } catch {}
    }
    showToast(`🚨 Beeped horn & flashed headlamps for ${selectedVehicle?.make} ${selectedVehicle?.model}!`, 'success');
  };

  return (
    <div className="page" style={{ paddingBottom: '90px' }}>
      <div className="container" style={{ maxWidth: '860px' }}>
        {/* Toast */}
        {toast && (
          <div className="toast-container">
            <div className={`toast ${toast.type}`}>
              <span>{toast.type === 'success' ? '✨' : toast.type === 'error' ? '⚠️' : 'ℹ️'}</span>
              <span>{toast.msg}</span>
            </div>
          </div>
        )}

        {/* ── Driver Header HUD ──────────────────────────────── */}
        <div
          className="account-card"
          style={{
            background: 'linear-gradient(135deg, rgba(212,175,55,0.12), rgba(16,16,22,0.95))',
            borderColor: 'var(--border-accent)',
            marginBottom: '20px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #1f1a10, #0c0b08)',
                  border: '2px solid var(--accent-gold)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.8rem',
                  boxShadow: '0 0 20px rgba(212,175,55,0.4)',
                }}
              >
                👨‍✈️
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    {user?.displayName || 'Executive Chauffeur'}
                  </h1>
                  <span
                    className="badge"
                    style={{
                      background: dutyStatus === 'ON_DUTY' ? 'rgba(52,211,153,0.15)' : 'rgba(212,175,55,0.15)',
                      color: dutyStatus === 'ON_DUTY' ? '#34d399' : 'var(--accent-gold)',
                      border: '1px solid currentColor',
                      fontSize: '0.72rem',
                    }}
                  >
                    ● {dutyStatus.replace('_', ' ')}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  ID: CHAUFFEUR-CHENNAI-04 · VIP Chauffeur Dispatch
                </div>
              </div>
            </div>

            {/* Quick Status Pill */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setDutyStatus(dutyStatus === 'ON_DUTY' ? 'OFF_DUTY' : 'ON_DUTY')}
                style={{ fontSize: '0.75rem', padding: '6px 12px' }}
              >
                {dutyStatus === 'ON_DUTY' ? 'Go Off Duty' : 'Clock In / On Duty'}
              </button>
            </div>
          </div>

          {/* Broadcast status telemetry bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '10px',
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(212,175,55,0.15)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Phone GPS Broadcast</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', fontWeight: 700 }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isSharing ? '#34d399' : '#f87171',
                    boxShadow: isSharing ? '0 0 8px #34d399' : 'none',
                    display: 'inline-block',
                  }}
                />
                <span style={{ color: isSharing ? '#34d399' : '#f87171', fontSize: '0.88rem' }}>
                  {isSharing ? (simulating ? 'Broadcasting (Sim)' : 'Broadcasting Live') : 'Paused'}
                </span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Pings Sent</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent-gold-light)', marginTop: '2px' }}>
                {pingsSent} telemetry pings
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>GPS Accuracy</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)', marginTop: '2px' }}>
                {driverPos?.accuracy ? `±${Math.round(driverPos.accuracy)}m` : 'Detecting...'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Last Sync</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)', marginTop: '2px' }}>
                {lastPingTime}
              </div>
            </div>
          </div>
        </div>

        {/* ── Vehicle Selection & Locator Card ───────────────── */}
        <div className="account-card" style={{ marginBottom: '20px' }}>
          <div className="account-card-header" style={{ marginBottom: '14px' }}>
            <div>
              <h2 className="account-card-title" style={{ fontSize: '1.15rem' }}>
                🎯 Locate Assigned Vehicle
              </h2>
              <p className="account-card-desc" style={{ margin: 0 }}>
                Select your assigned luxury vehicle to calculate walking distance and compass guidance in Chennai.
              </p>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ fontSize: '0.82rem' }}>
              Choose Vehicle from Fleet Roster:
            </label>
            <select
              className="form-control"
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(Number(e.target.value))}
              style={{ fontWeight: 600 }}
            >
              {fleet.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.make} {v.model} ({v.registration}) · {v.type} · Status: {v.status}
                </option>
              ))}
            </select>
          </div>

          {/* Live Proximity & Compass Guidance Display */}
          {driverPos && vehiclePos && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '14px',
                padding: '16px',
                background: 'rgba(12,12,18,0.7)',
                borderRadius: '14px',
                border: '1px solid rgba(212,175,55,0.2)',
                marginBottom: '16px',
              }}
            >
              {/* Distance */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    background: 'rgba(212,175,55,0.12)',
                    border: '1px solid var(--accent-gold)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem',
                  }}
                >
                  🚶
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                    Distance to Vehicle
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-gold-light)' }}>
                    {formattedDistance}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-green)' }}>
                    ~{estimatedWalkTime} min walk away
                  </div>
                </div>
              </div>

              {/* Compass Needle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, #251e12 0%, #0d0c0a 100%)',
                    border: '2px solid var(--accent-gold)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 16px rgba(212,175,55,0.3)',
                    transform: `rotate(${distanceInfo.bearing}deg)`,
                    transition: 'transform 0.4s ease-out',
                  }}
                  title={`Heading: ${Math.round(distanceInfo.bearing)}°`}
                >
                  <span style={{ fontSize: '1.4rem', display: 'block', transform: 'translateY(-2px)' }}>
                    ⬆️
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                    Walking Compass
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Head {getCompassDirection(distanceInfo.bearing)} ({Math.round(distanceInfo.bearing)}°)
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Bearing to {selectedVehicle?.make}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Vehicle Guidance Actions */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={openExternalNavigation}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>🧭</span>
              <span>Open Walking Route (Google Maps)</span>
            </button>

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleHornFlash}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>🚨</span>
              <span>Beep Horn / Flash Lamps</span>
            </button>

            <Link
              href={`/map?vehicle=${selectedVehicleId}`}
              className="btn btn-ghost btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}
            >
              <span>🛰️</span>
              <span>Full Radar View →</span>
            </Link>
          </div>
        </div>

        {/* ── Interactive Guidance Map (Driver + Vehicle) ────── */}
        <div className="account-card" style={{ marginBottom: '20px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              📍 Live Driver & Vehicle Radar
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
                Your Phone
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#d4af37', display: 'inline-block' }} />
                Vehicle ({selectedVehicle?.make})
              </span>
            </div>
          </div>

          <div style={{ height: '320px', width: '100%' }}>
            <DriverVehicleMap
              driverPos={driverPos}
              vehiclePos={
                vehiclePos
                  ? {
                      latitude: vehiclePos.latitude,
                      longitude: vehiclePos.longitude,
                      make: selectedVehicle?.make,
                      model: selectedVehicle?.model,
                      registration: selectedVehicle?.registration,
                    }
                  : null
              }
              distanceMeters={distanceInfo.distance}
            />
          </div>
        </div>

        {/* ── Trip & Departure Workflow Card ──────────────────── */}
        <div className="account-card" style={{ marginBottom: '20px' }}>
          <div className="account-card-header" style={{ marginBottom: '12px' }}>
            <h3 className="account-card-title">🚗 Pre-Departure & Trip Operations</h3>
            <span className="badge badge-available">
              {tripState === 'IDLE' ? 'READY TO DEPART' : tripState === 'DEPARTED' ? 'IN TRANSIT' : 'TRIP COMPLETED'}
            </span>
          </div>

          <p className="account-card-desc">
            Perform vehicle pre-check, initiate client charter departure, and log trip completion.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '14px' }}>
            {tripState === 'IDLE' && (
              <button
                type="button"
                className="btn btn-success"
                onClick={() => {
                  setTripState('DEPARTED');
                  setDutyStatus('EN_ROUTE');
                  showToast(`Trip started! ${selectedVehicle?.make} ${selectedVehicle?.model} is now In Transit 🚗💨`, 'success');
                }}
              >
                🚀 Depart / Start Trip
              </button>
            )}

            {tripState === 'DEPARTED' && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setTripState('ARRIVED');
                  setDutyStatus('ARRIVED');
                  showToast('Destination reached! Trip completed.', 'success');
                }}
              >
                🏁 Arrive & Complete Trip
              </button>
            )}

            {tripState === 'ARRIVED' && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setTripState('IDLE');
                  setDutyStatus('ON_DUTY');
                  showToast('Reset ready for next charter booking.', 'info');
                }}
              >
                ↺ Reset for Next Charter
              </button>
            )}

            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => showToast('Emergency Chauffeur SOS dispatched to central operations hub 🚨', 'error')}
              style={{ color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}
            >
              🚨 Emergency SOS
            </button>
          </div>
        </div>
      </div>

      {/* ── Bottom Sticky Action Bar (Mobile-Friendly) ─────── */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(10, 10, 14, 0.94)',
          borderTop: '1px solid rgba(212,175,55,0.3)',
          backdropFilter: 'blur(16px)',
          padding: '12px 20px',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.8)',
        }}
      >
        <div style={{ width: '100%', maxWidth: '860px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          {!isSharing ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={startSharingLocation}
              style={{ flex: 1, padding: '12px 18px', fontSize: '0.95rem', fontWeight: 800 }}
            >
              📡 Start Sharing Phone Location
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-danger"
              onClick={stopSharingLocation}
              style={{ flex: 1, padding: '12px 18px', fontSize: '0.95rem', fontWeight: 800 }}
            >
              ⏹️ Stop Sharing Location ({pingsSent} sent)
            </button>
          )}

          {!simulating ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={startSimulation}
              title="Test movement simulation on desktop"
              style={{ fontSize: '0.8rem', padding: '10px 14px' }}
            >
              🧪 Test Sim
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                if (simIntervalRef.current) clearInterval(simIntervalRef.current);
                setSimulating(false);
              }}
              style={{ fontSize: '0.8rem', padding: '10px 14px', color: 'var(--accent-gold)' }}
            >
              Stop Sim
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
