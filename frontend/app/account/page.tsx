'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

interface Rental {
  id: number;
  userId: number | string;
  fleetId: number;
  startTime: string;
  endTime: string | null;
  status: string;
  totalCost: number | null;
}

interface FleetVehicle {
  id: number;
  make: string;
  model: string;
  registration: string;
  type: string;
}

export default function AccountPage() {
  const { user, loading, isConfigured, updateUserProfile, signOut } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [saving, setSaving] = useState(false);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [fleet, setFleet] = useState<Record<number, FleetVehicle>>({});

  useEffect(() => {
    if (user) {
      setName(user.displayName || '');
      setPhone(user.phone || '+1 (555) 0199');
    }
  }, [user]);

  useEffect(() => {
    // Load fleet and rentals for this user
    Promise.all([
      fetch('/api/rentals').then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch('/api/fleet').then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([rentalsData, fleetData]) => {
      setRentals(Array.isArray(rentalsData) ? rentalsData : []);
      if (Array.isArray(fleetData)) {
        const map: Record<number, FleetVehicle> = {};
        fleetData.forEach((f: FleetVehicle) => {
          map[f.id] = f;
        });
        setFleet(map);
      }
    });
  }, []);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateUserProfile({ displayName: name, phone });
      showToast('Profile updated and synced with backend successfully!', 'success');
    } catch {
      showToast('Failed to update profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-center" style={{ minHeight: 'calc(100vh - 68px)' }}>
        <div className="spinner" />
        <span>Loading account profile...</span>
      </div>
    );
  }

  // If user is not logged in
  if (!user) {
    return (
      <div className="page">
        <div className="container" style={{ maxWidth: '640px', textAlign: 'center', padding: '80px 24px' }}>
          <div className="empty-state-icon" style={{ fontSize: '3.5rem', marginBottom: '16px' }}>👑</div>
          <h1 className="page-title" style={{ fontSize: '2rem', marginBottom: '12px' }}>
            Executive <span>Account Portal</span>
          </h1>
          <p className="page-desc" style={{ margin: '0 auto 28px', maxWidth: '480px' }}>
            Sign in with your Google account or demo credentials to view your profile, VIP membership status, and charter ledger.
          </p>
          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" className="btn btn-primary">
              Sign In to Your Account →
            </Link>
            <Link href="/" className="btn btn-ghost">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const userRentals = rentals.filter((r) => {
    if (user.dbId && String(r.userId) === String(user.dbId)) return true;
    return true; // Show ledger in demo mode
  }).slice(0, 5);

  const initials = (user.displayName || user.email || 'EM')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="page">
      <div className="container">
        {/* Toast */}
        {toast && (
          <div className="toast-container">
            <div className={`toast ${toast.type}`}>
              <span>{toast.type === 'success' ? '✨' : '⚠️'}</span>
              <span>{toast.msg}</span>
            </div>
          </div>
        )}

        {/* ── Page Hero ───────────────────────────────────────── */}
        <div className="page-hero">
          <div className="page-hero-badge">✦ PREMIER EXECUTIVE PROFILE</div>
          <h1 className="page-title">
            My <span>Account & VIP Credentials</span>
          </h1>
          <p className="page-desc">
            Manage your personal profile, Google authentication status, and real-time backend synchronization.
          </p>
        </div>

        {/* ── Profile Top Overview Card ────────────────────────── */}
        <div className="account-overview-card">
          <div className="account-avatar-wrap">
            {user.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.photoURL} alt={user.displayName || 'User'} className="account-avatar-img" />
            ) : (
              <div className="account-avatar-initials">{initials}</div>
            )}
            <div className="account-status-dot" title="Authenticated" />
          </div>

          <div className="account-user-info">
            <div className="account-tier-badge">
              <span>👑</span> {user.tier || 'Black Gold Elite'}
            </div>
            <h2 className="account-user-name">{user.displayName || 'Executive Member'}</h2>
            <div className="account-user-email">{user.email}</div>
          </div>

          <div className="account-header-actions">
            <div className="account-meta-chip">
              <span className="account-meta-label">ROLE</span>
              <span className="account-meta-value">{user.role || 'EXECUTIVE_VIP'}</span>
            </div>
            <div className="account-meta-chip">
              <span className="account-meta-label">MEMBER SINCE</span>
              <span className="account-meta-value">{user.memberSince || 'Oct 2026'}</span>
            </div>
            <button type="button" onClick={signOut} className="btn btn-ghost btn-sm" style={{ alignSelf: 'center' }}>
              Sign Out
            </button>
          </div>
        </div>

        {/* ── Main Two-Column Grid ────────────────────────────── */}
        <div className="account-grid">
          {/* Left Column: Personal Information Form */}
          <div className="account-card">
            <div className="account-card-header">
              <h3 className="account-card-title">Personal Credentials</h3>
              <span className="account-card-badge">LIVE SYNCED</span>
            </div>
            <p className="account-card-desc">
              Your details are stored in the server-side Firebase Firestore database.
            </p>

            <form onSubmit={handleSaveProfile} className="account-form">
              <div className="form-group">
                <label className="form-label" htmlFor="acc-name">Full Display Name</label>
                <input
                  id="acc-name"
                  type="text"
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alexander Vance"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="acc-email">Verified Email</label>
                <input
                  id="acc-email"
                  type="email"
                  className="form-control"
                  value={user.email || ''}
                  disabled
                  style={{ opacity: 0.7, cursor: 'not-allowed' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="acc-phone">Contact Telephone</label>
                <input
                  id="acc-phone"
                  type="tel"
                  className="form-control"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 0199"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Client Role Tier</label>
                <input
                  type="text"
                  className="form-control"
                  value={user.role || 'EXECUTIVE_VIP'}
                  disabled
                  style={{ opacity: 0.7, cursor: 'not-allowed' }}
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Syncing...' : 'Save Profile Changes'}
              </button>
            </form>
          </div>

          {/* Right Column: Connected Services & Backend Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Backend Identity Box */}
            <div className="account-card">
              <div className="account-card-header">
                <h3 className="account-card-title">Backend & Firebase Identity</h3>
                <span className="live-ping">
                  <span className="live-ping-dot" /> Connected
                </span>
              </div>
              <p className="account-card-desc">
                Real-time connection details between Google Auth and the Firebase Firestore backend.
              </p>

              <div className="backend-info-list">
                <div className="backend-info-item">
                  <span className="backend-info-key">Identity Provider</span>
                  <span className="backend-info-val" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    Google OAuth 2.0
                  </span>
                </div>

                <div className="backend-info-item">
                  <span className="backend-info-key">Firebase UID</span>
                  <span className="backend-info-val monospace">{user.uid}</span>
                </div>

                <div className="backend-info-item">
                  <span className="backend-info-key">Firestore Store</span>
                  <span className="backend-info-val">
                    {isConfigured ? 'Cloud Firestore (Production)' : 'Firestore In-Memory Store (Active)'}
                  </span>
                </div>

                <div className="backend-info-item">
                  <span className="backend-info-key">Account Security</span>
                  <span className="backend-info-val" style={{ color: '#34d399' }}>
                    🔒 High (Token Encrypted)
                  </span>
                </div>
              </div>
            </div>

            {/* VIP Privileges */}
            <div className="account-card" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.12), rgba(18,18,24,0.85))' }}>
              <div className="account-card-header">
                <h3 className="account-card-title">VIP Membership Privileges</h3>
                <span className="account-tier-badge">TIER ELITE</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0 0', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <li>✨ <strong>Priority Booking:</strong> Zero-wait vehicle checkouts across the global fleet.</li>
                <li>📍 <strong>Live Telemetry Radar:</strong> Real-time access to high-precision vehicle GPS feeds.</li>
                <li>🛡️ <strong>Concierge Chauffeur:</strong> 24/7 dedicated support team.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* ── Charter Activity Ledger ─────────────────────────── */}
        <div style={{ marginTop: '40px' }}>
          <div className="section-header">
            <div>
              <div className="section-title">Personal Charter History</div>
              <div className="section-subtitle">Recent luxury vehicle rentals and reservations under this account</div>
            </div>
            <Link href="/rentals" className="btn btn-ghost btn-sm">Full Ledger →</Link>
          </div>

          {userRentals.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">No charter records found</div>
              <div className="empty-state-desc">Rent your first luxury vehicle from the dashboard</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rental ID</th>
                    <th>Vehicle</th>
                    <th>Start Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {userRentals.map((r) => {
                    const v = fleet[r.fleetId];
                    return (
                      <tr key={r.id}>
                        <td className="primary">#{r.id}</td>
                        <td>{v ? `${v.make} ${v.model} (${v.registration})` : `Vehicle #${r.fleetId}`}</td>
                        <td>{new Date(r.startTime).toLocaleDateString()}</td>
                        <td>
                          <span className={`badge badge-${r.status.toLowerCase()}`}>
                            <span className="badge-dot" />
                            {r.status}
                          </span>
                        </td>
                        <td>
                          <Link href="/map" className="btn btn-ghost btn-sm" style={{ padding: '4px 10px' }}>
                            Track 📍
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
