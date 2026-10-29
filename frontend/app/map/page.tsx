'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useWebSocket } from '@/hooks/useVehicleTracker';

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

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

interface Fleet {
  id: number; make: string; model: string; type: string;
  registration: string; status: string;
}

function MapContent() {
  const searchParams = useSearchParams();
  const vehicleParam = searchParams.get('vehicle');

  const { status, positions, lastUpdate } = useWebSocket();
  const [fleet,      setFleet]      = useState<Fleet[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [updateCount, setUpdateCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch(`${API}/fleet`)
      .then(r => r.ok ? r.json() : [])
      .then(d => {
        const fleetList = Array.isArray(d) ? d : [];
        setFleet(fleetList);
        if (vehicleParam) {
          const match = fleetList.find(v => String(v.id) === String(vehicleParam));
          if (match) setSelectedId(match.id);
        }
      })
      .catch(console.error);
  }, [vehicleParam]);

  // Count updates
  useEffect(() => {
    if (lastUpdate) setUpdateCount(c => c + 1);
  }, [lastUpdate]);

  const wsLabel =
    status === 'connected'  ? 'Connected — live GPS' :
    status === 'connecting' ? 'Connecting to server...' :
    status === 'error'      ? 'Connection error' : 'Offline';

  const vehiclesWithPosition = Object.keys(positions).map(Number);

  const filteredFleet = fleet.filter(v => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.make.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q) ||
      v.registration.toLowerCase().includes(q) ||
      v.type.toLowerCase().includes(q)
    );
  });

  return (
    <div className="map-layout">
      {/* ── Sidebar ──────────────────────────────────────── */}
      <aside className="map-sidebar">
        <div className="map-sidebar-header">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div className="map-sidebar-title">🛰️ Telemetry Radar</div>
            {selectedId && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding:'2px 8px', fontSize:'0.72rem' }}
                onClick={() => setSelectedId(null)}
              >
                Clear Focus
              </button>
            )}
          </div>
          <div className="map-sidebar-sub" style={{ marginBottom:'8px' }}>
            {vehiclesWithPosition.length} vehicle{vehiclesWithPosition.length !== 1 ? 's' : ''} on radar
          </div>

          {/* Connection status */}
          <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
            <div className="ws-indicator" style={{ display:'inline-flex', fontSize:'0.72rem' }}>
              <div className={`ws-dot ${status}`} />
              <span>{wsLabel}</span>
            </div>
            {updateCount > 0 && (
              <div className="live-ping" style={{ fontSize:'0.72rem' }}>
                <div className="live-ping-dot" />
                {updateCount} ping{updateCount !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Search Box */}
          <div style={{ marginTop:'10px' }}>
            <input
              type="text"
              className="form-control"
              style={{ fontSize:'0.78rem', padding:'6px 10px', height:'auto' }}
              placeholder="Search make, model, plate..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="map-sidebar-list">
          {filteredFleet.length === 0 ? (
            <div className="empty-state" style={{ padding:'32px 16px' }}>
              <div className="empty-state-icon">🚗</div>
              <div className="empty-state-title" style={{ fontSize:'0.85rem' }}>No matching vehicles</div>
              <div className="empty-state-desc">Try clearing your search query</div>
            </div>
          ) : (
            filteredFleet.map(v => {
              const loc = positions[v.id];
              const isLive = loc ? (Date.now() - loc.timestamp < 10_000) : false;
              const isSelected = selectedId === v.id;
              return (
                <div
                  key={v.id}
                  className={`map-vehicle-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedId(v.id)}
                  style={{ cursor:'pointer' }}
                >
                  <div className="map-vehicle-icon">
                    {{ Car:'🚗', Scooter:'🛵', Motorcycle:'🏍️', Truck:'🚛', Van:'🚐' }[v.type] ?? '🚗'}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div className="map-vehicle-name">{v.make} {v.model}</div>
                      <span className={`badge badge-${v.status.toLowerCase()}`} style={{ fontSize:'0.65rem', padding:'2px 6px' }}>
                        {v.status}
                      </span>
                    </div>
                    <div style={{ fontSize:'0.72rem', color:'var(--text-dim)', marginBottom:'4px' }}>
                      {v.registration} · {v.type}
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
                            Live Telemetry
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="map-no-coords">Stationary / Base Hub</div>
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
            background:'rgba(12,12,16,0.92)', border:'1px solid rgba(212,175,55,0.3)',
            borderRadius:'16px', padding:'24px 32px', zIndex:1000,
            textAlign:'center', backdropFilter:'blur(16px)',
            boxShadow:'0 8px 32px rgba(0,0,0,0.8), 0 0 24px rgba(212,175,55,0.15)',
          }}>
            <div style={{ fontSize:'2rem', marginBottom:'8px' }}>📡</div>
            <div style={{ fontWeight:700, marginBottom:'6px', color:'var(--text-primary)' }}>Waiting for GPS Telemetry</div>
            <div style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>
              Start the simulator: <code style={{ color:'var(--accent-gold-light)', background:'rgba(212,175,55,0.1)', padding:'2px 6px', borderRadius:'4px' }}>npm start</code> in the <code style={{ color:'var(--accent-gold-light)', background:'rgba(212,175,55,0.1)', padding:'2px 6px', borderRadius:'4px' }}>simulator/</code> folder
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={
      <div className="loading-center" style={{ minHeight:'calc(100vh - 68px)' }}>
        <div className="spinner" />
        <span>Loading telemetry map...</span>
      </div>
    }>
      <MapContent />
    </Suspense>
  );
}
