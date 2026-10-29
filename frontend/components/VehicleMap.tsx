'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { VehiclePositions } from '@/hooks/useVehicleTracker';

// ── Fix Leaflet default icon paths in Next.js ──────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
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
function createVehicleIcon(type: string, isLive: boolean, driverName?: string) {
  const emoji = TYPE_EMOJI[type] ?? '🚗';
  const glowColor = isLive ? '#d4af37' : '#997819';
  const driverInitials = (driverName || 'DR')
    .split(' ')
    .map(w => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return L.divIcon({
    className: '',
    html: `
      <div style="
        position:relative; display:flex; align-items:center; justify-content:center;
        width:48px; height:48px;
      ">
        ${isLive ? `<div style="
          position:absolute; width:48px; height:48px; border-radius:50%;
          background:${glowColor}33; border:2px solid ${glowColor};
          animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;
        "></div>` : ''}
        <div style="
          width:38px; height:38px; border-radius:50%;
          background:linear-gradient(135deg,#1f1a10,#0c0b08);
          border:2px solid ${glowColor};
          display:flex; align-items:center; justify-content:center;
          font-size:1.2rem; box-shadow:0 0 16px ${glowColor}66;
          position:relative; z-index:1;
        ">
          ${emoji}
        </div>
        ${driverName ? `
          <div style="
            position:absolute; bottom:-4px; right:-2px; z-index:3;
            background:#10b981; border:1.5px solid #ffffff; border-radius:10px;
            padding:1px 5px; font-size:9px; font-weight:900; color:#ffffff;
            box-shadow:0 2px 6px rgba(0,0,0,0.6);
          " title="Active Driver: ${driverName}">
            ${driverInitials}
          </div>
        ` : ''}
      </div>
      <style>
        @keyframes ping {
          0%   { transform:scale(1); opacity:0.8; }
          100% { transform:scale(1.8); opacity:0; }
        }
      </style>
    `,
    iconSize:   [48, 48],
    iconAnchor: [24, 24],
    popupAnchor:[0, -24],
  });
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
  trails?:     Record<number, Array<[number, number]>>;
  selectedId?: number | null;
  onSelect:    (id: number) => void;
}

// ── Main Map Component ───────────────────────────────────────
export default function VehicleMap({ positions, fleetData, trails = {}, selectedId, onSelect }: VehicleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<number, L.Marker>>({});
  const polylinesRef = useRef<Record<number, L.Polyline>>({});
  const fittedRef = useRef(false);

  // 1. Initialize Map
  useEffect(() => {
    if (!containerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    const container = containerRef.current as any;
    if (container._leaflet_id) {
      delete container._leaflet_id;
    }

    const map = L.map(containerRef.current, {
      center: [13.0827, 80.2707], // Chennai
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
      polylinesRef.current = {};
    };
  }, []);

  // 2. Auto-fit bounds on initial positions load
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fittedRef.current) return;

    const entries = Object.values(positions);
    if (entries.length === 0) return;

    if (entries.length === 1) {
      map.setView([entries[0].latitude, entries[0].longitude], 14, { animate: true });
    } else {
      const bounds = L.latLngBounds(entries.map(p => [p.latitude, p.longitude]));
      map.fitBounds(bounds.pad(0.25), { animate: true });
    }
    fittedRef.current = true;
  }, [positions]);

  // 3. Update Markers & Live Breadcrumb Trails
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentMarkers = markersRef.current;
    const currentPolylines = polylinesRef.current;
    const activeIds = new Set<number>();

    Object.values(positions).forEach((loc) => {
      activeIds.add(loc.fleetId);
      const vehicle = fleetData.find(f => f.id === loc.fleetId);
      const isLive  = Date.now() - loc.timestamp < 15_000;
      const icon    = createVehicleIcon(vehicle?.type ?? 'Car', isLive, loc.driverName);
      const latLng: [number, number] = [loc.latitude, loc.longitude];

      const popupContent = `
        <div style="min-width: 220px; font-family: 'Inter', sans-serif; padding: 2px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <div style="font-weight: 800; font-size: 1rem; color: #111;">
              ${vehicle ? `${vehicle.make} ${vehicle.model}` : `Vehicle #${loc.fleetId}`}
            </div>
            <span style="font-size: 0.68rem; background: ${isLive ? 'rgba(16,185,129,0.15)' : 'rgba(212,175,55,0.15)'}; color: ${isLive ? '#059669' : '#b45309'}; padding: 2px 6px; border-radius: 4px; font-weight: 800;">
              ${isLive ? '● LIVE BEACON' : 'STANDBY'}
            </span>
          </div>

          ${vehicle ? `
            <div style="font-size: 0.78rem; color: #6b7280; margin-bottom: 8px;">
              ${vehicle.registration} · ${vehicle.type}
            </div>
          ` : ''}

          <!-- Live Driver Card -->
          <div style="background: rgba(212,175,55,0.12); border: 1px solid rgba(212,175,55,0.3); border-radius: 8px; padding: 8px 10px; margin-bottom: 8px;">
            <div style="font-size: 0.65rem; color: #997819; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase;">
              CURRENT DRIVER (PHONE GPS)
            </div>
            <div style="font-weight: 800; font-size: 0.9rem; color: #111; margin-top: 2px;">
              👨‍✈️ ${loc.driverName || 'Executive Chauffeur'}
            </div>
            <div style="font-size: 0.72rem; color: #4b5563;">
              ${loc.driverEmail || 'driver@velocitifleet.com'}
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 10px; font-size: 0.78rem;">
            <span style="color: #6b7280;">Speed</span>
            <span style="font-weight: 800; color: #059669;">${loc.speed.toFixed(1)} km/h</span>
            <span style="color: #6b7280;">Heading</span>
            <span>🧭 ${loc.heading}°</span>
            <span style="color: #6b7280;">GPS Precision</span>
            <span>±${loc.accuracy || 5}m</span>
            <span style="color: #6b7280;">Last Ping</span>
            <span style="color: #b45309; font-weight: 600;">${Math.max(0, Math.round((Date.now() - loc.timestamp) / 1000))}s ago</span>
          </div>
        </div>
      `;

      // Update or create marker
      if (currentMarkers[loc.fleetId]) {
        const marker = currentMarkers[loc.fleetId];
        marker.setLatLng(latLng);
        marker.setIcon(icon);
        const popup = marker.getPopup();
        if (popup) popup.setContent(popupContent);
      } else {
        const marker = L.marker(latLng, { icon }).addTo(map);
        marker.bindPopup(popupContent);
        marker.on('click', () => onSelect(loc.fleetId));
        currentMarkers[loc.fleetId] = marker;
      }

      // Live Breadcrumb Trail for this vehicle
      const vehicleTrail = trails[loc.fleetId] || [];
      if (vehicleTrail.length > 1) {
        if (currentPolylines[loc.fleetId]) {
          currentPolylines[loc.fleetId].setLatLngs(vehicleTrail);
        } else {
          currentPolylines[loc.fleetId] = L.polyline(vehicleTrail, {
            color: '#d4af37',
            weight: 3.5,
            opacity: 0.8,
            dashArray: '4, 6',
          }).addTo(map);
        }
      }
    });

    // Clean up markers no longer active
    Object.keys(currentMarkers).forEach((key) => {
      const id = Number(key);
      if (!activeIds.has(id)) {
        currentMarkers[id].remove();
        delete currentMarkers[id];
        if (currentPolylines[id]) {
          currentPolylines[id].remove();
          delete currentPolylines[id];
        }
      }
    });
  }, [positions, fleetData, trails, onSelect]);

  // 4. Auto-open popup and smoothly pan to vehicle when selectedId changes
  useEffect(() => {
    if (selectedId && markersRef.current[selectedId]) {
      const marker = markersRef.current[selectedId];
      marker.openPopup();
      if (mapRef.current) {
        mapRef.current.flyTo(marker.getLatLng(), 15, { animate: true, duration: 0.8 });
      }
    }
  }, [selectedId]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
