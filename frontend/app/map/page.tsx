'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useWebSocket } from '@/hooks/useWebSocket';

// Dynamically import the map (Leaflet needs window — must be CSR only)
const VehicleMap = dynamic(() => import('@/components/VehicleMap'), {
  ssr: false,
  loading: () => (
    <div className="loading-center" style={{ height:'100%', background:'#0d1526' }}>
      <div className="spinner" />
      <span>Initialising map...</span>
    </div>
  ),
});

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

interface Fleet {
  id: number; make: string; model: string; type: string;
  registration: string; status: string;
}

export default function MapPage() {
  const { status, positions, lastUpdate } = useWebSocket();
  const [fleet,      setFleet]      = useState<Fleet[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [updateCount, setUpdateCount] = useState(0);

  useEffect(() => {
    fetch(`${API}/fleet`).then(r => r.json()).then(setFleet).catch(console.error);
  }, []);

  // Count updates
  useEffect(() => {
    if (lastUpdate) setUpdateCount(c => c + 1);
  }, [lastUpdate]);

  const wsLabel =
    status === 'connected'  ? 'Connected — receiving live GPS' :
    status === 'connecting' ? 'Connecting to server...' :
    status === 'error'      ? 'Connection error' : 'Offline';

  const vehiclesWithPosition = Object.keys(positions).map(Number);

  return (
    <div className="map-layout">
      {/* ── Sidebar ──────────────────────────────────────── */}
      <aside className="map-sidebar">
        <div className="map-sidebar-header">
          <div className="map-sidebar-title">🗺️ Live Tracking</div>
          <div className="map-sidebar-sub" style={{ marginBottom:'8px' }}>
            {vehiclesWithPosition.length} vehicle{vehiclesWithPosition.length !== 1 ? 's' : ''} on map
          </div>
          {/* Connection status */}
          <div className="ws-indicator" style={{ display:'inline-flex', fontSize:'0.72rem' }}>
            <div className={`ws-dot ${status}`} />
            <span>{wsLabel}</span>
          </div>
          {updateCount > 0 && (
            <div style={{ marginTop:'8px' }} className="live-ping">
              <div className="live-ping-dot" />
              {updateCount} update{updateCount !== 1 ? 's' : ''} received
            </div>
          )}
        </div>

        <div className="map-sidebar-list">
          {fleet.length === 0 ? (
            <div className="empty-state" style={{ padding:'32px 16px' }}>
              <div className="empty-state-icon">🚗</div>
              <div className="empty-state-title" style={{ fontSize:'0.85rem' }}>No fleet data</div>
              <div className="empty-state-desc">Start the backend and simulator</div>
            </div>
          ) : (
            fleet.map(v => {
              const loc = positions[v.id];
              const isLive = loc ? (Date.now() - loc.timestamp < 10_000) : false;
              return (
                <div
                  key={v.id}
                  className={`map-vehicle-item ${selectedId === v.id ? 'selected' : ''}`}
                  onClick={() => setSelectedId(v.id)}
                >
                  <div className="map-vehicle-icon">
                    {{ Car:'🚗', Scooter:'🛵', Motorcycle:'🏍️', Truck:'🚛', Van:'🚐' }[v.type] ?? '🚗'}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div className="map-vehicle-name">{v.make} {v.model}</div>
                    <div style={{ fontSize:'0.72rem', color:'var(--text-dim)', marginBottom:'4px' }}>
                      {v.registration}
                    </div>
                    {loc ? (
                      <>
                        <div className="map-vehicle-coords">
                          {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                        </div>
                        <div style={{ display:'flex', gap:'8px', marginTop:'4px', fontSize:'0.72rem', color:'var(--text-muted)' }}>
                          <span>⚡ {loc.speed.toFixed(1)} km/h</span>
                          <span>🧭 {loc.heading}°</span>
                        </div>
                        {isLive && (
                          <div className="live-ping" style={{ marginTop:'4px' }}>
                            <div className="live-ping-dot" />
                            Live
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="map-no-coords">No GPS signal</div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Map ──────────────────────────────────────────── */}
      <div className="map-container">
        <VehicleMap
          positions={positions}
          fleetData={fleet}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

        {/* Floating info overlay */}
        {Object.keys(positions).length === 0 && status === 'connected' && (
          <div style={{
            position:'absolute', top:'50%', left:'50%',
            transform:'translate(-50%,-50%)',
            background:'rgba(6,11,24,0.9)', border:'1px solid rgba(0,212,255,0.2)',
            borderRadius:'16px', padding:'24px 32px', zIndex:1000,
            textAlign:'center', backdropFilter:'blur(12px)',
          }}>
            <div style={{ fontSize:'2rem', marginBottom:'8px' }}>📡</div>
            <div style={{ fontWeight:700, marginBottom:'6px' }}>Waiting for GPS data</div>
            <div style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>
              Start the simulator: <code style={{ color:'var(--accent-blue)' }}>npm start</code> in the <code style={{ color:'var(--accent-blue)' }}>simulator/</code> folder
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
