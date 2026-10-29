'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface DriverVehicleMapProps {
  driverPos: { latitude: number; longitude: number; accuracy?: number } | null;
  vehiclePos: { latitude: number; longitude: number; make?: string; model?: string; registration?: string } | null;
  distanceMeters?: number | null;
}

export default function DriverVehicleMap({ driverPos, vehiclePos, distanceMeters }: DriverVehicleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const driverAccuracyRef = useRef<L.Circle | null>(null);
  const vehicleMarkerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

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

    const defaultCenter: [number, number] = vehiclePos
      ? [vehiclePos.latitude, vehiclePos.longitude]
      : driverPos
      ? [driverPos.latitude, driverPos.longitude]
      : [13.0827, 80.2707]; // Chennai Center

    const map = L.map(containerRef.current, {
      center: defaultCenter,
      zoom: 15,
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
    };
  }, []); // Run once on mount

  // 2. Update Markers and Line
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Driver Marker
    if (driverPos) {
      const driverLatLng: [number, number] = [driverPos.latitude, driverPos.longitude];
      const driverIcon = L.divIcon({
        className: '',
        html: `
          <div style="position:relative; width:40px; height:40px; display:flex; align-items:center; justify-content:center;">
            <div style="position:absolute; width:40px; height:40px; border-radius:50%; background:rgba(59,130,246,0.35); border:2px solid #3b82f6; animation:driverPulse 1.8s infinite;"></div>
            <div style="width:28px; height:28px; border-radius:50%; background:linear-gradient(135deg, #1d4ed8, #3b82f6); border:2px solid #ffffff; box-shadow:0 0 16px #3b82f6; display:flex; align-items:center; justify-content:center; font-size:13px; z-index:2;">
              📱
            </div>
          </div>
          <style>
            @keyframes driverPulse {
              0%   { transform:scale(0.85); opacity:0.9; }
              100% { transform:scale(1.8);  opacity:0; }
            }
          </style>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      if (!driverMarkerRef.current) {
        driverMarkerRef.current = L.marker(driverLatLng, { icon: driverIcon }).addTo(map);
        driverMarkerRef.current.bindPopup('<b>📱 Your Phone Location</b><br/>Sharing GPS beacon');
      } else {
        driverMarkerRef.current.setLatLng(driverLatLng);
        driverMarkerRef.current.setIcon(driverIcon);
      }

      // Accuracy circle
      if (driverPos.accuracy && driverPos.accuracy < 200) {
        if (!driverAccuracyRef.current) {
          driverAccuracyRef.current = L.circle(driverLatLng, {
            radius: driverPos.accuracy,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.12,
            weight: 1,
          }).addTo(map);
        } else {
          driverAccuracyRef.current.setLatLng(driverLatLng);
          driverAccuracyRef.current.setRadius(driverPos.accuracy);
        }
      }
    } else {
      if (driverMarkerRef.current) {
        driverMarkerRef.current.remove();
        driverMarkerRef.current = null;
      }
      if (driverAccuracyRef.current) {
        driverAccuracyRef.current.remove();
        driverAccuracyRef.current = null;
      }
    }

    // Vehicle Marker
    if (vehiclePos) {
      const vehicleLatLng: [number, number] = [vehiclePos.latitude, vehiclePos.longitude];
      const vehicleIcon = L.divIcon({
        className: '',
        html: `
          <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center;">
            <div style="position:absolute; width:44px; height:44px; border-radius:50%; background:rgba(212,175,55,0.3); border:2px solid #d4af37; animation:vehiclePulse 2s infinite;"></div>
            <div style="width:34px; height:34px; border-radius:50%; background:linear-gradient(135deg, #1f1a10, #0c0b08); border:2px solid #d4af37; box-shadow:0 0 18px rgba(212,175,55,0.7); display:flex; align-items:center; justify-content:center; font-size:16px; z-index:2;">
              🚗
            </div>
          </div>
          <style>
            @keyframes vehiclePulse {
              0%   { transform:scale(0.9); opacity:0.8; }
              100% { transform:scale(1.7); opacity:0; }
            }
          </style>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });

      if (!vehicleMarkerRef.current) {
        vehicleMarkerRef.current = L.marker(vehicleLatLng, { icon: vehicleIcon }).addTo(map);
        vehicleMarkerRef.current.bindPopup(
          `<b>🚗 ${vehiclePos.make || ''} ${vehiclePos.model || 'Target Vehicle'}</b><br/>${vehiclePos.registration || 'Chennai Fleet'}`
        );
      } else {
        vehicleMarkerRef.current.setLatLng(vehicleLatLng);
        vehicleMarkerRef.current.setIcon(vehicleIcon);
      }
    } else {
      if (vehicleMarkerRef.current) {
        vehicleMarkerRef.current.remove();
        vehicleMarkerRef.current = null;
      }
    }

    // Guidance Line between Driver and Vehicle
    if (driverPos && vehiclePos) {
      const points: [number, number][] = [
        [driverPos.latitude, driverPos.longitude],
        [vehiclePos.latitude, vehiclePos.longitude],
      ];

      if (!polylineRef.current) {
        polylineRef.current = L.polyline(points, {
          color: '#d4af37',
          weight: 3,
          dashArray: '6, 8',
          opacity: 0.85,
        }).addTo(map);
      } else {
        polylineRef.current.setLatLngs(points);
      }

      // Auto-fit both markers
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds.pad(0.3), { animate: true });
    } else {
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }
      if (driverPos) {
        map.panTo([driverPos.latitude, driverPos.longitude], { animate: true });
      } else if (vehiclePos) {
        map.panTo([vehiclePos.latitude, vehiclePos.longitude], { animate: true });
      }
    }
  }, [driverPos, vehiclePos, distanceMeters]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '260px',
        borderRadius: '16px',
        overflow: 'hidden',
        border: '1px solid rgba(212,175,55,0.25)',
      }}
    />
  );
}
