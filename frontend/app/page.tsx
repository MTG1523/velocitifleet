'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

interface Fleet {
  id: number; make: string; model: string; type: string;
  registration: string; status: string; year: number; dailyRate: number;
}
interface User {
  id: number | string; name: string; phone: string; email: string; role: string;
}
interface Rental {
  id: number | string; userId: number | string; fleetId: number | string; startTime: string;
  endTime: string | null; status: string; totalCost: number | null;
}

const TYPE_EMOJI: Record<string, string> = {
  Car:'🚗', Scooter:'🛵', Motorcycle:'🏍️', Truck:'🚛', Van:'🚐',
};

function StatusBadge({ status }: { status: string }) {
  const cls = `badge badge-${status.toLowerCase()}`;
  return <span className={cls}><span className="badge-dot"/>{status}</span>;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [fleet,   setFleet]   = useState<Fleet[]>([]);
  const [users,   setUsers]   = useState<User[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showRegister, setShowRegister] = useState(false);
  const [showRent,     setShowRent]     = useState(false);
  const [rentTarget,   setRentTarget]   = useState<Fleet | null>(null);
  const [toast,        setToast]        = useState<{msg:string; type:'success'|'error'} | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form state
  const [regForm, setRegForm] = useState({ name:'', phone:'', email:'', role:'CUSTOMER' });
  const [rentForm, setRentForm] = useState({ userId: '' });

  const showToast = (msg: string, type: 'success'|'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAll = useCallback(async () => {
    try {
      const [f, u, r] = await Promise.all([
        fetch(`${API}/fleet`).then(res => res.ok ? res.json() : []).catch(() => []),
        fetch(`${API}/users`).then(res => res.ok ? res.json() : []).catch(() => []),
        fetch(`${API}/rentals`).then(res => res.ok ? res.json() : []).catch(() => []),
      ]);
      setFleet(Array.isArray(f) ? f : []);
      setUsers(Array.isArray(u) ? u : []);
      setRentals(Array.isArray(r) ? r : []);
    } catch { showToast('Failed to load data — is the backend running?', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const fleetList = Array.isArray(fleet) ? fleet : [];
  const rentalsList = Array.isArray(rentals) ? rentals : [];

  const stats = {
    total:       fleetList.length,
    available:   fleetList.filter(f => f.status === 'AVAILABLE').length,
    rented:      fleetList.filter(f => f.status === 'RENTED').length,
    maintenance: fleetList.filter(f => f.status === 'MAINTENANCE').length,
  };

  // Register client
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/users`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(regForm),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Registration failed');
      }
      setShowRegister(false);
      setRegForm({ name:'', phone:'', email:'', role:'CUSTOMER' });
      showToast('Client registered successfully!', 'success');
      loadAll();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setActionLoading(false);
    }
  }

  // Rent vehicle
  async function handleRent(e: React.FormEvent) {
    e.preventDefault();
    if (!rentTarget) return;

    const chosenUserId = rentForm.userId || (user ? (user.dbId || user.uid) : '');
    if (!chosenUserId) {
      showToast('Please select or specify a user to rent', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`${API}/rentals/checkout`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ userId: String(chosenUserId), fleetId: String(rentTarget.id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');

      setShowRent(false);
      setRentForm({ userId:'' });
      showToast(`${rentTarget.make} ${rentTarget.model} rented successfully! 🚗`, 'success');
      loadAll();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setActionLoading(false);
    }
  }

  // Complete rental
  async function handleCompleteRental(rentalId: number | string) {
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/rentals/${rentalId}/complete`, { method:'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to complete rental');
      showToast(`Rental #${rentalId} returned & settled. Cost: $${data.totalCost?.toFixed(2) ?? '0.00'}`, 'success');
      loadAll();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setActionLoading(false);
    }
  }

  // Quick return directly from vehicle card
  async function handleQuickReturn(fleetId: number) {
    const activeRental = rentalsList.find(r => String(r.fleetId) === String(fleetId) && r.status === 'ACTIVE');
    if (activeRental) {
      await handleCompleteRental(activeRental.id);
    } else {
      // Direct status fallback
      await handleStatusChange(fleetId, 'AVAILABLE');
    }
  }

  // Status change (maintenance / available)
  async function handleStatusChange(id: number, status: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/fleet/${id}/status?status=${status}`, { method:'PATCH' });
      if (!res.ok) throw new Error('Status update failed');
      showToast(`Vehicle #${id} marked as ${status}`, 'success');
      loadAll();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setActionLoading(false);
    }
  }

  const activeRentals = rentalsList.filter(r => r.status === 'ACTIVE').slice(0, 6);

  if (loading) return (
    <div className="loading-center" style={{ minHeight: 'calc(100vh - 64px)' }}>
      <div className="spinner" />
      <span>Loading fleet operations...</span>
    </div>
  );

  return (
    <div className="page">
      <div className="container">

        {/* ── Hero ─────────────────────────────────────────── */}
        <div className="page-hero">
          <div className="page-hero-badge">✦ PREMIER FLEET TELEMETRY & OPERATIONS</div>
          <h1 className="page-title">
            Executive Fleet,<br /><span>Precision in Motion</span>
          </h1>
          <p className="page-desc">
            Next-generation fleet operations, luxury vehicle rentals, and real-time live GPS telemetry tracking.
          </p>
          <div style={{ display:'flex', gap:'12px', marginTop:'22px', flexWrap:'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowRegister(true)}
              id="hero-register-btn"
            >
              + Register Client
            </button>
            <Link href="/map" className="btn btn-ghost" id="hero-live-map-link">
              🗺️ Live Radar Map
            </Link>
            <Link href="/rentals" className="btn btn-ghost" id="hero-rentals-link">
              🔑 Rentals Ledger
            </Link>
          </div>
        </div>

        {/* ── Stats ─────────────────────────────────────────── */}
        <div className="stats-grid">
          {[
            { icon:'🏎️', label:'Total Fleet',   value:stats.total,       color:'#d4af37' },
            { icon:'✨', label:'Available',     value:stats.available,   color:'#34d399' },
            { icon:'🔑', label:'Active Rentals',value:stats.rented,      color:'#f7e199' },
            { icon:'⚙️', label:'Service',       value:stats.maintenance, color:'#fbbf24' },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ ['--stat-color' as string]: s.color }}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Fleet Grid ────────────────────────────────────── */}
        <div style={{ marginBottom:'40px' }}>
          <div className="section-header">
            <div>
              <div className="section-title">Fleet Vehicles</div>
              <div className="section-subtitle">{fleet.length} luxury vehicles registered in Chennai</div>
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              <Link href="/fleet" className="btn btn-ghost btn-sm">Full Roster →</Link>
            </div>
          </div>

          {fleet.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🚗</div>
              <div className="empty-state-title">No vehicles yet</div>
              <div className="empty-state-desc">Add vehicles via the Fleet page</div>
            </div>
          ) : (
            <div className="fleet-grid">
              {fleet.slice(0, 6).map(v => (
                <div key={v.id} className="vehicle-card">
                  <div className="vehicle-card-header">
                    <div className="vehicle-icon-wrap">{TYPE_EMOJI[v.type] ?? '🚗'}</div>
                    <StatusBadge status={v.status} />
                  </div>
                  <div className="vehicle-card-body">
                    <div className="vehicle-make">{v.make}</div>
                    <div className="vehicle-name">{v.model}</div>
                    <div className="vehicle-reg">{v.registration}</div>
                    <div className="vehicle-meta">
                      <div className="vehicle-meta-item">
                        <span className="vehicle-meta-label">Type</span>
                        <span className="vehicle-meta-value">{v.type}</span>
                      </div>
                      <div className="vehicle-meta-item">
                        <span className="vehicle-meta-label">Year</span>
                        <span className="vehicle-meta-value">{v.year ?? '—'}</span>
                      </div>
                      <div className="vehicle-meta-item">
                        <span className="vehicle-meta-label">Rate/Day</span>
                        <span className="vehicle-meta-value" style={{ color:'var(--accent-gold)' }}>
                          ${v.dailyRate?.toFixed(2) ?? '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="vehicle-card-footer" style={{ flexWrap:'wrap', gap:'6px' }}>
                    {v.status === 'AVAILABLE' && (
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={() => {
                          setRentTarget(v);
                          setRentForm({ userId: user ? String(user.dbId || user.uid) : '' });
                          setShowRent(true);
                        }}
                      >
                        🔑 Rent Now
                      </button>
                    )}
                    {v.status === 'RENTED' && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ fontSize:'0.75rem', padding:'4px 10px' }}
                        onClick={() => handleQuickReturn(v.id)}
                        disabled={actionLoading}
                      >
                        ✓ Return / Settle
                      </button>
                    )}
                    {v.status === 'MAINTENANCE' && (
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        style={{ fontSize:'0.75rem', padding:'4px 10px' }}
                        onClick={() => handleStatusChange(v.id, 'AVAILABLE')}
                        disabled={actionLoading}
                      >
                        ✅ Mark Ready
                      </button>
                    )}
                    <Link
                      href={`/map?vehicle=${v.id}`}
                      className="btn btn-ghost btn-sm"
                      title="Track live vehicle location on radar"
                    >
                      📍 Track
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Active Rentals ────────────────────────────────── */}
        <div>
          <div className="section-header">
            <div>
              <div className="section-title">Active Rentals</div>
              <div className="section-subtitle">{activeRentals.length} ongoing rentals on ledger</div>
            </div>
            <Link href="/rentals" className="btn btn-ghost btn-sm">Manage Rentals →</Link>
          </div>

          {activeRentals.length === 0 ? (
            <div className="empty-state" style={{ padding:'32px' }}>
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">No active rentals</div>
              <div className="empty-state-desc">Click &quot;Rent Now&quot; on any available vehicle above to start a charter</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rental ID</th>
                    <th>Vehicle</th>
                    <th>Client</th>
                    <th>Started</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRentals.map(r => {
                    const v = fleet.find(f => String(f.id) === String(r.fleetId));
                    const u = users.find(u => String(u.id) === String(r.userId));
                    return (
                      <tr key={r.id}>
                        <td className="primary">#{r.id}</td>
                        <td className="primary">
                          {v ? `${v.make} ${v.model}` : `Fleet #${r.fleetId}`}
                          {v && <span style={{ fontSize:'0.72rem', color:'var(--text-dim)', display:'block' }}>{v.registration}</span>}
                        </td>
                        <td>
                          {u?.name ?? (user ? `${user.displayName} (Me)` : `Client #${r.userId}`)}
                          {u && <span style={{ fontSize:'0.72rem', color:'var(--text-dim)', display:'block' }}>{u.phone}</span>}
                        </td>
                        <td>{new Date(r.startTime).toLocaleString()}</td>
                        <td><StatusBadge status={r.status} /></td>
                        <td>
                          <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              style={{ padding:'4px 10px', fontSize:'0.75rem' }}
                              onClick={() => handleCompleteRental(r.id)}
                              disabled={actionLoading}
                            >
                              ✓ Complete
                            </button>
                            <Link
                              href={`/map?vehicle=${r.fleetId}`}
                              className="btn btn-ghost btn-sm"
                              style={{ padding:'4px 10px', fontSize:'0.75rem' }}
                            >
                              📍 Track
                            </Link>
                          </div>
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

      {/* ── Register User Modal ───────────────────────────── */}
      {showRegister && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowRegister(false)}>
          <div className="modal">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div className="modal-title">Register New Client</div>
                <div className="modal-subtitle">Add a customer, driver, or VIP to the platform</div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding:'4px 8px', fontSize:'1rem', lineHeight:1 }}
                onClick={() => setShowRegister(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-control" required placeholder="Alexander Vance"
                  value={regForm.name} onChange={e => setRegForm({...regForm, name:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-control" required placeholder="+91 98765 43210"
                  value={regForm.phone} onChange={e => setRegForm({...regForm, phone:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-control" type="email" required placeholder="alexander@velocitifleet.com"
                  value={regForm.email} onChange={e => setRegForm({...regForm, email:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Client Role</label>
                <select className="form-control"
                  value={regForm.role} onChange={e => setRegForm({...regForm, role:e.target.value})}>
                  <option value="CUSTOMER">Customer / VIP Client</option>
                  <option value="DRIVER">Executive Chauffeur / Driver</option>
                  <option value="ADMIN">Fleet Administrator</option>
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowRegister(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Registering...' : 'Register Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Rent Vehicle Modal ────────────────────────────── */}
      {showRent && rentTarget && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowRent(false)}>
          <div className="modal">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div className="modal-title">Rent Vehicle</div>
                <div className="modal-subtitle">
                  {TYPE_EMOJI[rentTarget.type]} {rentTarget.make} {rentTarget.model} — ${rentTarget.dailyRate?.toFixed(2)}/day
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding:'4px 8px', fontSize:'1rem', lineHeight:1 }}
                onClick={() => setShowRent(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleRent}>
              <div className="form-group">
                <label className="form-label">Select Client / Charter Account</label>
                <select
                  className="form-control"
                  required
                  value={rentForm.userId}
                  onChange={e => setRentForm({...rentForm, userId:e.target.value})}
                >
                  <option value="">Choose an account...</option>
                  {user && (
                    <option value={user.dbId || user.uid}>
                      👑 {user.displayName || user.email} (Current User - {user.tier || 'VIP Elite'})
                    </option>
                  )}
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.role} ({u.phone})
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowRent(false)}>Cancel</button>
                <button type="submit" className="btn btn-success" disabled={actionLoading}>
                  {actionLoading ? 'Processing...' : '🔑 Confirm Rental'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────────── */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}
