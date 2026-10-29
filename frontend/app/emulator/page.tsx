'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface GoogleAccount {
  id: string;
  name: string;
  email: string;
  avatarBg: string;
  initial: string;
}

const DEFAULT_ACCOUNTS: GoogleAccount[] = [
  {
    id: 'g-acc-1',
    name: 'Mokaanth D',
    email: 'mokaanth.dev@gmail.com',
    avatarBg: '#1a73e8',
    initial: 'M',
  },
  {
    id: 'g-acc-2',
    name: 'Velociti Dispatch Chauffeur',
    email: 'chauffeur.velociti@gmail.com',
    avatarBg: '#ea4335',
    initial: 'V',
  },
  {
    id: 'g-acc-3',
    name: 'Carlos Diaz',
    email: 'carlos.diaz.chauffeur@gmail.com',
    avatarBg: '#34a853',
    initial: 'C',
  },
  {
    id: 'g-acc-4',
    name: 'Eve Wilson',
    email: 'eve.wilson.velociti@gmail.com',
    avatarBg: '#fbbc05',
    initial: 'E',
  },
];

interface FleetCar {
  id: number;
  make: string;
  model: string;
  registrationNumber: string;
  status: string;
  icon: string;
}

const FLEET_CARS: FleetCar[] = [
  { id: 1, make: 'Ferrari', model: 'F8 Tributo', registrationNumber: 'TN 01 AB 0007', status: 'AVAILABLE', icon: '🏎️' },
  { id: 2, make: 'Lamborghini', model: 'Huracán Evo', registrationNumber: 'TN 07 EV 8888', status: 'AVAILABLE', icon: '⚡' },
  { id: 3, make: 'Rolls-Royce', model: 'Ghost Extended', registrationNumber: 'TN 09 RR 0001', status: 'AVAILABLE', icon: '👑' },
  { id: 4, make: 'Porsche', model: '911 GT3 RS', registrationNumber: 'TN 02 GT 9911', status: 'AVAILABLE', icon: '🏁' },
  { id: 5, make: 'Bentley', model: 'Continental GT', registrationNumber: 'TN 04 BG 1234', status: 'AVAILABLE', icon: '💎' },
];

// Chennai Coordinates presets
const ROUTES = {
  marina: {
    name: 'Chennai Marina Beach Promenade',
    startLat: 13.0499,
    startLng: 80.2824,
    deltaLat: 0.0006,
    deltaLng: 0.0001,
  },
  guindy: {
    name: 'Guindy & OMR IT Express Highway',
    startLat: 13.0067,
    startLng: 80.2025,
    deltaLat: -0.0005,
    deltaLng: 0.0007,
  },
  airport: {
    name: 'Chennai International Airport (GST Road)',
    startLat: 12.9815,
    startLng: 80.1636,
    deltaLat: 0.0004,
    deltaLng: 0.0005,
  },
};

export default function DriverEmulatorPage() {
  // Accounts State
  const [deviceAccounts, setDeviceAccounts] = useState<GoogleAccount[]>(DEFAULT_ACCOUNTS);
  const [selectedAccount, setSelectedAccount] = useState<GoogleAccount | null>(DEFAULT_ACCOUNTS[0]);
  const [isChooserOpen, setIsChooserOpen] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isAuthenticatingId, setIsAuthenticatingId] = useState<string | null>(null);

  // App screen state ('auth' or 'cockpit')
  const [screen, setScreen] = useState<'auth' | 'cockpit'>('auth');

  // Vehicle & Driving State
  const [selectedVehicle, setSelectedVehicle] = useState<FleetCar>(FLEET_CARS[0]);
  const [isDriving, setIsDriving] = useState(false);
  const [selectedRouteKey, setSelectedRouteKey] = useState<keyof typeof ROUTES>('marina');
  const [simSpeed, setSimSpeed] = useState(58);
  const [pingsCount, setPingsCount] = useState(0);
  const [lastPingTime, setLastPingTime] = useState('Standby');
  const [lastPayload, setLastPayload] = useState<Record<string, unknown> | null>(null);

  // Live Position
  const [currentCoords, setCurrentCoords] = useState({
    lat: ROUTES.marina.startLat,
    lng: ROUTES.marina.startLng,
    heading: 184,
  });

  const driveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle Account Selection
  const handleSelectAccount = (acc: GoogleAccount) => {
    setIsAuthenticatingId(acc.id);
    setTimeout(() => {
      setSelectedAccount(acc);
      setIsAuthenticatingId(null);
      setIsChooserOpen(false);
      setScreen('cockpit');
    }, 450);
  };

  // Add new Google Account
  const handleAddAccount = () => {
    if (!newEmail.trim() || !newEmail.includes('@')) {
      alert('Please enter a valid Google Account email.');
      return;
    }
    const email = newEmail.trim().toLowerCase();
    const name = newName.trim() || email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const colors = ['#1a73e8', '#ea4335', '#34a853', '#fbbc05', '#8e24aa', '#0097a7'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newAcc: GoogleAccount = {
      id: `g-acc-${Date.now()}`,
      name,
      email,
      avatarBg: randomColor,
      initial: name.charAt(0).toUpperCase(),
    };

    setDeviceAccounts([newAcc, ...deviceAccounts]);
    setNewName('');
    setNewEmail('');
    setIsAddingNew(false);
    handleSelectAccount(newAcc);
  };

  // Live Broadcast Loop
  useEffect(() => {
    if (!isDriving || !selectedAccount || !selectedVehicle) {
      if (driveTimerRef.current) clearInterval(driveTimerRef.current);
      return;
    }

    const route = ROUTES[selectedRouteKey];
    let step = 0;

    driveTimerRef.current = setInterval(async () => {
      step += 1;
      const progress = step * 0.05;
      const jitterLat = (Math.random() - 0.5) * 0.0001;
      const jitterLng = (Math.random() - 0.5) * 0.0001;

      const nextLat = route.startLat + Math.sin(progress) * route.deltaLat * 5 + jitterLat;
      const nextLng = route.startLng + Math.cos(progress) * route.deltaLng * 5 + jitterLng;
      const speedJitter = Math.floor(simSpeed + (Math.random() * 8 - 4));
      const nextHeading = Math.floor(180 + Math.sin(progress) * 45);

      setCurrentCoords({
        lat: parseFloat(nextLat.toFixed(6)),
        lng: parseFloat(nextLng.toFixed(6)),
        heading: nextHeading,
      });

      const payload = {
        fleetId: selectedVehicle.id,
        latitude: parseFloat(nextLat.toFixed(6)),
        longitude: parseFloat(nextLng.toFixed(6)),
        speed: speedJitter,
        heading: nextHeading,
        timestamp: Date.now(),
        accuracy: 3,
        driverName: selectedAccount.name,
        driverEmail: selectedAccount.email,
        driverPhoto: '',
      };

      setLastPayload(payload);
      setPingsCount((prev) => prev + 1);
      setLastPingTime(new Date().toLocaleTimeString());

      try {
        await fetch('/api/locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.warn('Ping transmit error:', err);
      }
    }, 2000);

    return () => {
      if (driveTimerRef.current) clearInterval(driveTimerRef.current);
    };
  }, [isDriving, selectedAccount, selectedVehicle, selectedRouteKey, simSpeed]);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#070709',
      color: '#f8f4eb',
      padding: '40px 20px',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Page Title & Breadcrumb */}
      <div style={{ maxWidth: '1200px', margin: '0 auto 30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '13px', color: '#d4af37', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Standalone Driver Application
            </span>
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'rgba(52,211,153,0.15)', color: '#34d399', fontWeight: 700, border: '1px solid rgba(52,211,153,0.3)' }}>
              Live Phone Emulator
            </span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, margin: 0, letterSpacing: '-0.5px' }}>
            VelocitiDriver <span style={{ color: '#d4af37' }}>Interactive Cockpit</span>
          </h1>
          <p style={{ fontSize: '14px', color: 'rgba(248,244,235,0.6)', margin: '6px 0 0' }}>
            Test multiple Google Accounts on-device sign in, vehicle selection, and live GPS streaming to the fleet radar.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <Link
            href="/map"
            target="_blank"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '12px',
              backgroundColor: 'rgba(212,175,55,0.15)',
              border: '1px solid #d4af37',
              color: '#f8f4eb',
              textDecoration: 'none',
              fontWeight: 800,
              fontSize: '13px',
            }}
          >
            <span>🗺️</span> Open Live Fleet Radar ↗
          </Link>
        </div>
      </div>

      {/* Main Container: Phone on Left, Controls on Right */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'minmax(340px, 400px) 1fr',
        gap: '40px',
        alignItems: 'start',
      }}>

        {/* ── PHONE EMULATOR FRAME ────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{
            width: '380px',
            height: '780px',
            backgroundColor: '#000000',
            borderRadius: '52px',
            border: '10px solid #28282f',
            boxShadow: '0 25px 60px rgba(0,0,0,0.9), 0 0 30px rgba(212,175,55,0.15), inset 0 0 4px rgba(255,255,255,0.2)',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Dynamic Island Pill */}
            <div style={{
              position: 'absolute',
              top: '12px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '105px',
              height: '26px',
              backgroundColor: '#000000',
              borderRadius: '20px',
              zIndex: 50,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 10px',
            }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '5px', backgroundColor: '#111827', border: '1px solid #1f2937' }} />
              <div style={{ width: '8px', height: '8px', borderRadius: '4px', backgroundColor: isDriving ? '#34d399' : '#047857' }} />
            </div>

            {/* Phone Status Bar */}
            <div style={{
              height: '44px',
              padding: '12px 24px 0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
              fontWeight: 700,
              color: '#ffffff',
              zIndex: 40,
            }}>
              <span>9:41</span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11px' }}>
                <span>5G</span>
                <span>📶</span>
                <span>🔋 100%</span>
              </div>
            </div>

            {/* Phone Screen Inner Container */}
            <div style={{
              flex: 1,
              backgroundColor: '#070709',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              position: 'relative',
              padding: '16px',
            }}>

              {/* ── SCREEN 1: CHAUFFEUR AUTHENTICATION ─────────────── */}
              {screen === 'auth' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
                  {/* Brand Logo */}
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '20px',
                      backgroundColor: 'rgba(212,175,55,0.12)',
                      border: '1.5px solid #d4af37',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '32px',
                      margin: '0 auto 12px',
                    }}>
                      👑
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '1px' }}>
                      VELOCITI<span style={{ color: '#d4af37' }}>DRIVER</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'rgba(248,244,235,0.5)', marginTop: '2px' }}>
                      Executive Telematics Cockpit
                    </div>
                  </div>

                  {/* Auth Card */}
                  <div style={{
                    backgroundColor: '#121217',
                    border: '1px solid rgba(212,175,55,0.25)',
                    borderRadius: '20px',
                    padding: '20px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '18px',
                        backgroundColor: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        fontWeight: 900,
                        color: '#4285F4',
                      }}>
                        G
                      </div>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 800 }}>Sign In with Google</div>
                        <div style={{ fontSize: '11px', color: 'rgba(248,244,235,0.5)' }}>Select device account to continue</div>
                      </div>
                    </div>

                    {/* Choose Google Account Button */}
                    <button
                      onClick={() => setIsChooserOpen(true)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '12px',
                        backgroundColor: '#ffffff',
                        border: 'none',
                        color: '#1f2937',
                        fontWeight: 800,
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      }}
                    >
                      <span style={{ color: '#4285F4', fontWeight: 900, fontSize: '16px' }}>G</span>
                      Choose Google Account ({deviceAccounts.length} on device)
                    </button>

                    {/* Detected Accounts on Phone Preview */}
                    <div style={{
                      marginTop: '16px',
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      borderRadius: '14px',
                      border: '1px solid rgba(212,175,55,0.15)',
                      padding: '10px',
                    }}>
                      <div style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(212,175,55,0.8)', letterSpacing: '0.8px', marginBottom: '8px', paddingLeft: '4px' }}>
                        ACCOUNTS ON THIS DEVICE
                      </div>
                      {deviceAccounts.slice(0, 3).map((acc) => (
                        <div
                          key={acc.id}
                          onClick={() => handleSelectAccount(acc)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(255,255,255,0.03)',
                            marginBottom: '6px',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                          }}
                        >
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '14px',
                            backgroundColor: acc.avatarBg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 800,
                            color: '#fff',
                          }}>
                            {acc.initial}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.name}</div>
                            <div style={{ fontSize: '10px', color: 'rgba(248,244,235,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.email}</div>
                          </div>
                          <span style={{ color: 'rgba(248,244,235,0.4)', fontSize: '14px' }}>›</span>
                        </div>
                      ))}

                      <div
                        onClick={() => setIsChooserOpen(true)}
                        style={{ textAlign: 'center', fontSize: '11px', color: '#d4af37', fontWeight: 700, padding: '6px 0', cursor: 'pointer' }}
                      >
                        + View all accounts / Use another account
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── SCREEN 2: CHAUFFEUR COCKPIT ────────────────────── */}
              {screen === 'cockpit' && selectedAccount && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Top Bar with User Profile Chip */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingBottom: '10px',
                    borderBottom: '1px solid rgba(212,175,55,0.2)',
                  }}>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 900 }}>
                        VELOCITI<span style={{ color: '#d4af37' }}>DRIVER</span>
                      </div>
                      <div style={{ fontSize: '10px', color: 'rgba(248,244,235,0.5)' }}>In-Vehicle GPS Broadcast</div>
                    </div>

                    <div
                      onClick={() => setIsChooserOpen(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 8px',
                        backgroundColor: 'rgba(212,175,55,0.12)',
                        border: '1px solid rgba(212,175,55,0.3)',
                        borderRadius: '12px',
                        cursor: 'pointer',
                      }}
                      title="Tap to Switch Google Account"
                    >
                      <div style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '11px',
                        backgroundColor: selectedAccount.avatarBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 800,
                        color: '#fff',
                      }}>
                        {selectedAccount.initial}
                      </div>
                      <div style={{ maxWidth: '90px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selectedAccount.name}
                        </div>
                        <div style={{ fontSize: '8px', color: '#34d399', fontWeight: 700 }}>Google Verified</div>
                      </div>
                    </div>
                  </div>

                  {/* Vehicle Selector Card */}
                  <div style={{
                    backgroundColor: '#121217',
                    borderRadius: '16px',
                    border: '1px solid rgba(212,175,55,0.2)',
                    padding: '12px',
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, marginBottom: '2px' }}>Assigned Vehicle</div>
                    {/* Live Beacon Tag on NEW LINE */}
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 8px',
                      borderRadius: '10px',
                      backgroundColor: isDriving ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${isDriving ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.1)'}`,
                      marginBottom: '8px',
                    }}>
                      <div style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '3px',
                        backgroundColor: isDriving ? '#34d399' : '#6b7280',
                      }} />
                      <span style={{ fontSize: '9px', fontWeight: 800, color: isDriving ? '#34d399' : '#9ca3af' }}>
                        {isDriving ? 'TRACKING ACTIVE' : 'GPS STANDBY'}
                      </span>
                    </div>

                    {/* Horizontal Vehicle Carousel */}
                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
                      {FLEET_CARS.map((car) => {
                        const isSel = selectedVehicle.id === car.id;
                        return (
                          <div
                            key={car.id}
                            onClick={() => !isDriving && setSelectedVehicle(car)}
                            style={{
                              flexShrink: 0,
                              padding: '8px 10px',
                              borderRadius: '10px',
                              backgroundColor: isSel ? 'rgba(212,175,55,0.16)' : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${isSel ? '#d4af37' : 'rgba(255,255,255,0.08)'}`,
                              cursor: isDriving ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <div style={{ fontSize: '16px' }}>{car.icon}</div>
                            <div style={{ fontSize: '11px', fontWeight: 800, marginTop: '4px' }}>{car.model}</div>
                            <div style={{ fontSize: '9px', color: 'rgba(248,244,235,0.5)' }}>{car.registrationNumber}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Cockpit Telemetry Box */}
                  <div style={{
                    backgroundColor: '#0c0c10',
                    borderRadius: '16px',
                    border: '1.5px solid rgba(212,175,55,0.3)',
                    padding: '14px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(248,244,235,0.45)', letterSpacing: '1px' }}>
                        TELEMETRY COCKPIT
                      </span>
                      {/* Streaming Vehicle GPS Badge on NEW LINE */}
                      <span style={{
                        fontSize: '9px',
                        padding: '2px 6px',
                        borderRadius: '8px',
                        backgroundColor: isDriving ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(212,175,55,0.3)',
                        color: isDriving ? '#d4af37' : '#9ca3af',
                        fontWeight: 700,
                      }}>
                        STREAMING VEHICLE GPS
                      </span>
                    </div>

                    {/* Gauges Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                      <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: 'rgba(248,244,235,0.5)' }}>SPEED</div>
                        <div style={{ fontSize: '24px', fontWeight: 900, color: isDriving ? '#34d399' : '#fff' }}>
                          {isDriving ? simSpeed : 0} <span style={{ fontSize: '11px', color: '#9ca3af' }}>KM/H</span>
                        </div>
                      </div>

                      <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: 'rgba(248,244,235,0.5)' }}>HEADING</div>
                        <div style={{ fontSize: '24px', fontWeight: 900, color: '#f7e199' }}>
                          {currentCoords.heading}° <span style={{ fontSize: '11px', color: '#9ca3af' }}>S</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '10px', color: 'rgba(248,244,235,0.5)', marginBottom: '4px' }}>
                      📍 Lat: {currentCoords.lat.toFixed(5)} · Lng: {currentCoords.lng.toFixed(5)}
                    </div>
                    <div style={{ fontSize: '10px', color: 'rgba(248,244,235,0.5)' }}>
                      ⚡ Broadcast Pings: <strong style={{ color: '#34d399' }}>{pingsCount}</strong> · Last: {lastPingTime}
                    </div>
                  </div>

                  {/* Primary Driving Action Button */}
                  <button
                    onClick={() => setIsDriving(!isDriving)}
                    style={{
                      padding: '14px',
                      borderRadius: '14px',
                      backgroundColor: isDriving ? '#dc2626' : '#d4af37',
                      color: isDriving ? '#ffffff' : '#070709',
                      border: 'none',
                      fontWeight: 900,
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      boxShadow: isDriving ? '0 8px 20px rgba(220,38,38,0.4)' : '0 8px 20px rgba(212,175,55,0.3)',
                    }}
                  >
                    <span>{isDriving ? '⏹️' : '🚀'}</span>
                    <span>{isDriving ? 'Stop Live GPS Broadcast' : 'Start Driving & Broadcast GPS'}</span>
                  </button>

                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                      onClick={() => setScreen('auth')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(248,244,235,0.5)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        padding: '6px',
                      }}
                    >
                      ← Switch Account or Logout
                    </button>
                  </div>
                </div>
              )}

              {/* ── GOOGLE ACCOUNT CHOOSER BOTTOM SHEET ───────────── */}
              {isChooserOpen && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                }}>
                  <div
                    onClick={() => setIsChooserOpen(false)}
                    style={{ flex: 1 }}
                  />

                  <div style={{
                    backgroundColor: '#202124',
                    borderTopLeftRadius: '24px',
                    borderTopRightRadius: '24px',
                    padding: '16px 18px 24px',
                    border: '1px solid #303134',
                    maxHeight: '440px',
                    overflowY: 'auto',
                  }}>
                    {/* Handle */}
                    <div style={{ width: '36px', height: '4px', borderRadius: '2px', backgroundColor: '#5f6368', margin: '0 auto 12px' }} />

                    {/* Google Header */}
                    <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '1px', fontSize: '18px', fontWeight: 800 }}>
                        <span style={{ color: '#4285F4' }}>G</span>
                        <span style={{ color: '#EA4335' }}>o</span>
                        <span style={{ color: '#FBBC05' }}>o</span>
                        <span style={{ color: '#4285F4' }}>g</span>
                        <span style={{ color: '#34A853' }}>l</span>
                        <span style={{ color: '#EA4335' }}>e</span>
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#e8eaed', marginTop: '2px' }}>Choose an account</div>
                      <div style={{ fontSize: '11px', color: '#9aa0a6' }}>
                        to continue to <strong style={{ color: '#8ab4f8' }}>VelocitiFleet Driver</strong>
                      </div>
                    </div>

                    <div style={{ height: '1px', backgroundColor: '#303134', margin: '8px 0 12px' }} />

                    {/* Accounts List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {deviceAccounts.map((acc) => {
                        const isCurrent = isAuthenticatingId === acc.id;
                        return (
                          <div
                            key={acc.id}
                            onClick={() => handleSelectAccount(acc)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '10px 12px',
                              borderRadius: '12px',
                              backgroundColor: isCurrent ? 'rgba(66,133,244,0.15)' : 'transparent',
                              cursor: 'pointer',
                              transition: 'background 0.2s',
                            }}
                          >
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '18px',
                              backgroundColor: acc.avatarBg,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '15px',
                              fontWeight: 800,
                              color: '#fff',
                            }}>
                              {acc.initial}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#e8eaed' }}>{acc.name}</div>
                              <div style={{ fontSize: '11px', color: '#9aa0a6' }}>{acc.email}</div>
                            </div>
                            {isCurrent ? (
                              <span style={{ fontSize: '11px', color: '#8ab4f8', fontWeight: 700 }}>Signing in...</span>
                            ) : (
                              <span style={{ color: '#5f6368', fontSize: '16px' }}>›</span>
                            )}
                          </div>
                        );
                      })}

                      {/* Add Another Account */}
                      {!isAddingNew ? (
                        <div
                          onClick={() => setIsAddingNew(true)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 12px',
                            borderRadius: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '18px',
                            backgroundColor: '#303134',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '16px',
                            color: '#8ab4f8',
                            fontWeight: 800,
                          }}>
                            ＋
                          </div>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#8ab4f8' }}>Use another account</div>
                            <div style={{ fontSize: '11px', color: '#9aa0a6' }}>Add a new Google Account</div>
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          backgroundColor: '#303134',
                          borderRadius: '12px',
                          padding: '12px',
                          marginTop: '4px',
                        }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#e8eaed', marginBottom: '8px' }}>
                            Add Google Account
                          </div>
                          <input
                            type="text"
                            placeholder="Full Name (e.g. John Doe)"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            style={{
                              width: '100%',
                              backgroundColor: '#202124',
                              border: '1px solid #5f6368',
                              borderRadius: '8px',
                              padding: '8px',
                              color: '#fff',
                              fontSize: '12px',
                              marginBottom: '6px',
                              boxSizing: 'border-box',
                            }}
                          />
                          <input
                            type="email"
                            placeholder="your.email@gmail.com"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            style={{
                              width: '100%',
                              backgroundColor: '#202124',
                              border: '1px solid #5f6368',
                              borderRadius: '8px',
                              padding: '8px',
                              color: '#fff',
                              fontSize: '12px',
                              marginBottom: '8px',
                              boxSizing: 'border-box',
                            }}
                          />
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => setIsAddingNew(false)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: '#9aa0a6',
                                fontSize: '11px',
                                cursor: 'pointer',
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleAddAccount}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '6px',
                                backgroundColor: '#1a73e8',
                                border: 'none',
                                color: '#fff',
                                fontWeight: 700,
                                fontSize: '11px',
                                cursor: 'pointer',
                              }}
                            >
                              Add & Sign In
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Disclaimer */}
                    <div style={{
                      marginTop: '14px',
                      paddingTop: '10px',
                      borderTop: '1px solid #303134',
                      fontSize: '10px',
                      color: '#9aa0a6',
                      lineHeight: '14px',
                      textAlign: 'center',
                    }}>
                      To continue, Google will share your name, email address, language preference, and profile picture with VelocitiFleet Driver.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Home Indicator Bar */}
            <div style={{
              height: '24px',
              backgroundColor: '#070709',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{ width: '120px', height: '4px', borderRadius: '2px', backgroundColor: 'rgba(255,255,255,0.4)' }} />
            </div>
          </div>
        </div>

        {/* ── EMULATOR STATION CONTROLS & MONITOR ──────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Quick Status Overview Card */}
          <div style={{
            backgroundColor: '#121217',
            borderRadius: '20px',
            border: '1px solid rgba(212,175,55,0.25)',
            padding: '24px',
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🎮</span> Emulator Telemetry Controls
            </h2>

            {/* Route Presets in Chennai */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'rgba(248,244,235,0.7)', marginBottom: '8px' }}>
                📍 Simulated Chennai Driving Route
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                {(Object.keys(ROUTES) as (keyof typeof ROUTES)[]).map((key) => {
                  const isSel = selectedRouteKey === key;
                  return (
                    <div
                      key={key}
                      onClick={() => setSelectedRouteKey(key)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '12px',
                        backgroundColor: isSel ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${isSel ? '#d4af37' : 'rgba(255,255,255,0.08)'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: isSel ? 800 : 600 }}>{ROUTES[key].name}</span>
                      <span style={{ fontSize: '11px', color: isSel ? '#34d399' : '#6b7280' }}>
                        {isSel ? '● Active' : 'Select'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cruising Speed Slider */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(248,244,235,0.7)' }}>
                  🏎️ Driving Speed
                </label>
                <span style={{ fontSize: '14px', fontWeight: 900, color: '#34d399' }}>{simSpeed} km/h</span>
              </div>
              <input
                type="range"
                min="0"
                max="140"
                value={simSpeed}
                onChange={(e) => setSimSpeed(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#d4af37', cursor: 'pointer' }}
              />
            </div>

            {/* Driver Quick Switch */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'rgba(248,244,235,0.7)', marginBottom: '8px' }}>
                👨‍✈️ Active Google Driver Account
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {deviceAccounts.map((acc) => {
                  const isCur = selectedAccount?.id === acc.id;
                  return (
                    <button
                      key={acc.id}
                      onClick={() => handleSelectAccount(acc)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '10px',
                        backgroundColor: isCur ? acc.avatarBg : 'rgba(255,255,255,0.06)',
                        color: '#fff',
                        border: isCur ? '1.5px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                        fontWeight: 700,
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>{acc.initial}</span>
                      <span>{acc.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Live Telemetry Stream Monitor */}
          <div style={{
            backgroundColor: '#121217',
            borderRadius: '20px',
            border: '1px solid rgba(212,175,55,0.25)',
            padding: '24px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⚡</span> Outgoing GPS Stream Packet
              </h3>
              <span style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '8px',
                backgroundColor: isDriving ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.06)',
                color: isDriving ? '#34d399' : '#9ca3af',
                fontWeight: 800,
                border: `1px solid ${isDriving ? 'rgba(52,211,153,0.4)' : 'transparent'}`,
              }}>
                {isDriving ? 'BROADCASTING LIVE (2s)' : 'STANDBY'}
              </span>
            </div>

            <pre style={{
              backgroundColor: '#070709',
              borderRadius: '12px',
              padding: '14px',
              fontSize: '12px',
              color: '#34d399',
              fontFamily: 'monospace',
              overflowX: 'auto',
              border: '1px solid rgba(255,255,255,0.06)',
              margin: 0,
            }}>
              {lastPayload
                ? JSON.stringify(lastPayload, null, 2)
                : '// Click "Start Driving & Broadcast GPS" inside the phone\n// to stream live GPS telemetry to the Fleet Radar'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
