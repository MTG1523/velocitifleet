'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { VehiclePositions } from '@/hooks/useWebSocket';

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
function createVehicleIcon(type: string, isLive: boolean) {
  const emoji = TYPE_EMOJI[type] ?? '🚗';
  const glowColor = isLive ? '#d4af37' : '#997819';
  return L.divIcon({
    className: '',
    html: `
      <div style="
        position:relative; display:flex; align-items:center; justify-content:center;
        width:44px; height:44px;
      ">
        ${isLive ? `<div style="
          position:absolute; width:44px; height:44px; border-radius:50%;
          background:${glowColor}33; border:2px solid ${glowColor};
          animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;
        "></div>` : ''}
        <div style="
          width:36px; height:36px; border-radius:50%;
          background:linear-gradient(135deg,#1f1a10,#0c0b08);
          border:2px solid ${glowColor};
          display:flex; align-items:center; justify-content:center;
          font-size:1.15rem; box-shadow:0 0 16px ${glowColor}66;
          position:relative; z-index:1;
        ">${emoji}</div>
      </div>
      <style>
        @keyframes ping {
          0%   { transform:scale(1); opacity:0.8; }
          100% { transform:scale(1.8); opacity:0; }
        }
      </style>
    `,
    iconSize:   [44, 44],
    iconAnchor: [22, 22],
    popupAnchor:[0, -22],
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
  selectedId?: number | null;
  onSelect:    (id: number) => void;
}

// ── Main Map Component ───────────────────────────────────────
export default function VehicleMap({ positions, fleetData, selectedId, onSelect }: VehicleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<number, L.Marker>>({});
  const fittedRef = useRef(false);

  // 1. Initialize Map
  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up any stale map instance on this DOM node (React 19 / HMR protection)
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    const container = containerRef.current as any;
    if (container._leaflet_id) {
      delete container._leaflet_id;
    }

    const map = L.map(containerRef.current, {
      center: [13.0827, 80.2707],
      zoom: 12,
      zoomControl: true,
    });

    // Free OpenStreetMap tile layer (dark theme via globals.css .leaflet-tile-pane filter)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
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

  // 3. Update Markers when positions or fleetData change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentMarkers = markersRef.current;
    const activeIds = new Set<number>();

    Object.values(positions).forEach((loc) => {
      activeIds.add(loc.fleetId);
      const vehicle = fleetData.find(f => f.id === loc.fleetId);
      const isLive  = Date.now() - loc.timestamp < 10_000;
      const icon    = createVehicleIcon(vehicle?.type ?? 'Car', isLive);
      const latLng: [number, number] = [loc.latitude, loc.longitude];

      const popupContent = `
        <div style="min-width: 180px; font-family: 'Inter', sans-serif;">
          <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 6px;">
            ${vehicle ? `${vehicle.make} ${vehicle.model}` : `Vehicle #${loc.fleetId}`}
          </div>
          ${vehicle ? `
            <div style="font-size: 0.78rem; color: #888; margin-bottom: 8px;">
              ${vehicle.registration} · ${vehicle.type}
            </div>
          ` : ''}
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; font-size: 0.8rem;">
            <span style="color: #666;">Lat</span>
            <span style="font-family: monospace;">${loc.latitude.toFixed(5)}</span>
            <span style="color: #666;">Lng</span>
            <span style="font-family: monospace;">${loc.longitude.toFixed(5)}</span>
            <span style="color: #666;">Speed</span>
            <span>${loc.speed.toFixed(1)} km/h</span>
            <span style="color: #666;">Heading</span>
            <span>${loc.heading}°</span>
          </div>
          ${isLive ? `
            <div style="margin-top: 8px;" class="live-ping">
              <div class="live-ping-dot"></div>
              Live
            </div>
          ` : ''}
        </div>
      `;

      if (currentMarkers[loc.fleetId]) {
        const marker = currentMarkers[loc.fleetId];
        marker.setLatLng(latLng);
        marker.setIcon(icon);
        const popup = marker.getPopup();
        if (popup) {
          popup.setContent(popupContent);
        }
      } else {
        const marker = L.marker(latLng, { icon }).addTo(map);
        marker.bindPopup(popupContent);
        marker.on('click', () => onSelect(loc.fleetId));
        currentMarkers[loc.fleetId] = marker;
      }
    });

    // Remove any markers for vehicles no longer present
    Object.keys(currentMarkers).forEach((key) => {
      const id = Number(key);
      if (!activeIds.has(id)) {
        currentMarkers[id].remove();
        delete currentMarkers[id];
      }
    });
  }, [positions, fleetData, onSelect]);

  // 4. Auto-open popup when selectedId changes
  useEffect(() => {
    if (selectedId && markersRef.current[selectedId]) {
      markersRef.current[selectedId].openPopup();
    }
  }, [selectedId]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
