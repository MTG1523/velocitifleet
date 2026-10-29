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
      <span>Initialising live radar map...</span>
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

  const { status, positions, lastUpdate, recentUpdates, trails } = useWebSocket();
  const [fleet,        setFleet]        = useState<Fleet[]>([]);
  const [selectedId,   setSelectedId]   = useState<number | null>(null);
  const [updateCount,  setUpdateCount]  = useState(0);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [activeTab,    setActiveTab]    = useState<'vehicles' | 'stream'>('vehicles');

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
    status === 'connected'  ? 'Connected — live GPS radar' :
    status === 'connecting' ? 'Connecting to telemetry...' :
    status === 'error'      ? 'Connection error' : 'Offline';

  const vehiclesWithPosition = Object.keys(positions).map(Number);

  const filteredFleet = fleet.filter(v => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const loc = positions[v.id];
    return (
      v.make.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q) ||
      v.registration.toLowerCase().includes(q) ||
      v.type.toLowerCase().includes(q) ||
      (loc?.driverName && loc.driverName.toLowerCase().includes(q))
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
            {vehiclesWithPosition.length} vehicle{vehiclesWithPosition.length !== 1 ? 's' : ''} tracked live in Chennai
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
                {updateCount} updates received
              </div>
            )}
          </div>

          {/* View Mode Tabs: Vehicles vs Live Telemetry Stream */}
          <div style={{ display:'flex', gap:'6px', marginTop:'12px', borderBottom:'1px solid rgba(212,175,55,0.2)', paddingBottom:'8px' }}>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'vehicles' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize:'0.75rem', padding:'4px 10px', flex:1 }}
              onClick={() => setActiveTab('vehicles')}
            >
              🚗 Fleet Roster ({vehiclesWithPosition.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'stream' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize:'0.75rem', padding:'4px 10px', flex:1 }}
              onClick={() => setActiveTab('stream')}
            >
              ⚡ Live Pings ({recentUpdates.length})
            </button>
          </div>

          {/* Search Box */}
          {activeTab === 'vehicles' && (
            <div style={{ marginTop:'10px' }}>
              <input
                type="text"
                className="form-control"
                style={{ fontSize:'0.78rem', padding:'6px 10px', height:'auto' }}
                placeholder="Search vehicle, driver or plate..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* ── Tab 1: Vehicles Roster with Live Drivers ────────── */}
        {activeTab === 'vehicles' && (
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
                const isLive = loc ? (Date.now() - loc.timestamp < 15_000) : false;
                const isSelected = selectedId === v.id;
                const secondsAgo = loc ? Math.max(0, Math.round((Date.now() - loc.timestamp) / 1000)) : null;

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

                      {/* Live Driver Badge */}
                      {loc?.driverName && (
                        <div style={{
                          display:'inline-flex', alignItems:'center', gap:'4px',
                          background:'rgba(212,175,55,0.12)', border:'1px solid rgba(212,175,55,0.3)',
                          borderRadius:'6px', padding:'2px 6px', margin:'2px 0 4px', fontSize:'0.72rem',
                          color:'var(--accent-gold-light)', fontWeight:700
                        }}>
                          <span>👨‍✈️</span>
                          <span>{loc.driverName}</span>
                          <span style={{ color:'#34d399', fontSize:'0.65rem' }}>✓ GPS</span>
                        </div>
                      )}

                      {loc ? (
                        <>
                          <div className="map-vehicle-coords">
                            {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                          </div>
                          <div style={{ display:'flex', gap:'8px', marginTop:'4px', fontSize:'0.72rem', color:'var(--text-muted)' }}>
                            <span style={{ color:'#34d399', fontWeight:700 }}>⚡ {loc.speed.toFixed(1)} km/h</span>
                            <span>🧭 {loc.heading}°</span>
                            <span style={{ color:'#f7e199' }}>⏱️ {secondsAgo}s ago</span>
                          </div>
                          {isLive && (
                            <div className="live-ping" style={{ marginTop:'4px' }}>
                              <div className="live-ping-dot" />
                              Active Live Beacon
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
        )}

        {/* ── Tab 2: Live Updates Stream Feed (Every Ping) ───── */}
        {activeTab === 'stream' && (
          <div className="map-sidebar-list">
            <div style={{ padding:'10px 14px', fontSize:'0.75rem', color:'var(--text-muted)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              Real-time stream of every GPS ping transmitted by active drivers:
            </div>

            {recentUpdates.length === 0 ? (
              <div className="empty-state" style={{ padding:'32px 16px' }}>
                <div className="empty-state-icon">📡</div>
                <div className="empty-state-title" style={{ fontSize:'0.85rem' }}>Awaiting pings</div>
                <div className="empty-state-desc">Pings from driver phones will appear here live</div>
              </div>
            ) : (
              recentUpdates.map((u, i) => {
                const vehicle = fleet.find(f => f.id === u.fleetId);
                const timeStr = new Date(u.timestamp).toLocaleTimeString();
                return (
                  <div
                    key={`${u.fleetId}_${u.timestamp}_${i}`}
                    style={{
                      padding:'10px 14px',
                      borderBottom:'1px solid rgba(255,255,255,0.05)',
                      backgroundColor: i === 0 ? 'rgba(52,211,153,0.06)' : 'transparent',
                      cursor:'pointer',
                    }}
                    onClick={() => setSelectedId(u.fleetId)}
                  >
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2px' }}>
                      <span style={{ fontWeight:800, fontSize:'0.8rem', color:'var(--accent-gold-light)' }}>
                        {vehicle ? `${vehicle.make} ${vehicle.model}` : `Fleet #${u.fleetId}`}
                      </span>
                      <span style={{ fontSize:'0.68rem', color:'var(--text-dim)', fontFamily:'monospace' }}>
                        {timeStr}
                      </span>
                    </div>

                    <div style={{ fontSize:'0.72rem', color:'#fff', fontWeight:600 }}>
                      👨‍✈️ {u.driverName || 'Executive Driver'}
                    </div>

                    <div style={{ display:'flex', gap:'8px', fontSize:'0.7rem', color:'var(--text-muted)', marginTop:'3px' }}>
                      <span style={{ fontFamily:'monospace' }}>{u.latitude.toFixed(4)}, {u.longitude.toFixed(4)}</span>
                      <span style={{ color:'#34d399', fontWeight:700 }}>⚡ {u.speed.toFixed(1)} km/h</span>
                      <span>🧭 {u.heading}°</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </aside>

      {/* ── Map ──────────────────────────────────────────── */}
      <div className="map-container">
        <VehicleMap
          positions={positions}
          fleetData={fleet}
          trails={trails}
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
              Launch the standalone mobile driver app or simulator to start streaming live vehicle coordinates in Chennai.
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
