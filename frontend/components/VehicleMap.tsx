'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LocationUpdate, VehiclePositions } from '@/hooks/useWebSocket';

// ── Fix Leaflet default icon paths in Next.js ──────────────
delete (L.Icon.Default.prototype as unknown as Record<string,unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Vehicle type → emoji ────────────────────────────────────
const TYPE_EMOJI: Record<string, string> = {
  Car:        '🚗',
  Scooter:    '🛵',
  Motorcycle: '🏍️',
  Truck:      '🚛',
  Van:        '🚐',
};

// ── Custom pulsing map marker ────────────────────────────────
function createVehicleIcon(type: string, isLive: boolean) {
  const emoji = TYPE_EMOJI[type] ?? '🚗';
  const glowColor = isLive ? '#00ff88' : '#00d4ff';
  return L.divIcon({
    className: '',
    html: `
      <div style="
        position:relative; display:flex; align-items:center; justify-content:center;
        width:44px; height:44px;
      ">
        ${isLive ? `<div style="
          position:absolute; width:44px; height:44px; border-radius:50%;
          background:${glowColor}22; border:2px solid ${glowColor};
          animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;
        "></div>` : ''}
        <div style="
          width:36px; height:36px; border-radius:50%;
          background:linear-gradient(135deg,#0d1526,#1a2a4a);
          border:2px solid ${glowColor};
          display:flex; align-items:center; justify-content:center;
          font-size:1.1rem; box-shadow:0 0 12px ${glowColor}44;
          position:relative; z-index:1;
        ">${emoji}</div>
      </div>
      <style>
        @keyframes ping {
          0%   { transform:scale(1); opacity:0.7; }
          100% { transform:scale(1.8); opacity:0; }
        }
      </style>
    `,
    iconSize:   [44, 44],
    iconAnchor: [22, 22],
    popupAnchor:[0, -22],
  });
}

// ── Sub-component: moves the map when positions change ──────
function MapAutoFit({ positions }: { positions: VehiclePositions }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    const entries = Object.values(positions);
    if (entries.length === 0 || fitted.current) return;
    if (entries.length === 1) {
      map.setView([entries[0].latitude, entries[0].longitude], 14, { animate: true });
    } else {
      const bounds = L.latLngBounds(entries.map(p => [p.latitude, p.longitude]));
      map.fitBounds(bounds.pad(0.25), { animate: true });
    }
    fitted.current = true;
  }, [positions, map]);

  return null;
}

// ── Props ────────────────────────────────────────────────────
interface FleetInfo {
  id: number;
  make: string;
  model: string;
  type: string;
  registration: string;
  status: string;
}

interface VehicleMapProps {
  positions:   VehiclePositions;
  fleetData:   FleetInfo[];
  selectedId?: number | null;
  onSelect:    (id: number) => void;
}

// ── Main Map Component ───────────────────────────────────────
export default function VehicleMap({ positions, fleetData, selectedId, onSelect }: VehicleMapProps) {
  const markerRefs = useRef<Record<number, L.Marker>>({});

  // Auto-open popup for selected vehicle
  useEffect(() => {
    if (selectedId && markerRefs.current[selectedId]) {
      markerRefs.current[selectedId].openPopup();
    }
  }, [selectedId]);

  // Default center: San Francisco
  const center: [number, number] = [37.774929, -122.419416];

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ width: '100%', height: '100%' }}
      zoomControl={true}
    >
      {/* Dark tile layer from CartoDB */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={20}
      />

      <MapAutoFit positions={positions} />

      {/* Render a marker for each vehicle with a known position */}
      {Object.values(positions).map((loc) => {
        const vehicle = fleetData.find(f => f.id === loc.fleetId);
        const isLive  = Date.now() - loc.timestamp < 10_000; // updated < 10s ago
        const icon    = createVehicleIcon(vehicle?.type ?? 'Car', isLive);

        return (
          <Marker
            key={loc.fleetId}
            position={[loc.latitude, loc.longitude]}
            icon={icon}
            ref={(ref) => { if (ref) markerRefs.current[loc.fleetId] = ref; }}
            eventHandlers={{ click: () => onSelect(loc.fleetId) }}
          >
            <Popup>
              <div style={{ minWidth: 180 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 6 }}>
                  {vehicle ? `${vehicle.make} ${vehicle.model}` : `Vehicle #${loc.fleetId}`}
                </div>
                {vehicle && (
                  <div style={{ fontSize: '0.78rem', color: '#888', marginBottom: 8 }}>
                    {vehicle.registration} · {vehicle.type}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '0.8rem' }}>
                  <span style={{ color: '#666' }}>Lat</span>
                  <span style={{ fontFamily: 'monospace' }}>{loc.latitude.toFixed(5)}</span>
                  <span style={{ color: '#666' }}>Lng</span>
                  <span style={{ fontFamily: 'monospace' }}>{loc.longitude.toFixed(5)}</span>
                  <span style={{ color: '#666' }}>Speed</span>
                  <span>{loc.speed.toFixed(1)} km/h</span>
                  <span style={{ color: '#666' }}>Heading</span>
                  <span>{loc.heading}°</span>
                </div>
                {isLive && (
                  <div style={{ marginTop: 8 }} className="live-ping">
                    <div className="live-ping-dot" />
                    Live
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
