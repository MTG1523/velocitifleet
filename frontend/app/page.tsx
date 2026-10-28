'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

interface Fleet {
  id: number; make: string; model: string; type: string;
  registration: string; status: string; year: number; dailyRate: number;
}
interface User {
  id: number; name: string; phone: string; email: string; role: string;
}
interface Rental {
  id: number; userId: number; fleetId: number; startTime: string;
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
  const [fleet,   setFleet]   = useState<Fleet[]>([]);
  const [users,   setUsers]   = useState<User[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showRegister, setShowRegister] = useState(false);
  const [showRent,     setShowRent]     = useState(false);
  const [rentTarget,   setRentTarget]   = useState<Fleet | null>(null);
  const [toast,        setToast]        = useState<{msg:string; type:'success'|'error'} | null>(null);

  // Form state
  const [regForm, setRegForm] = useState({ name:'', phone:'', email:'', role:'CUSTOMER' });
  const [rentForm, setRentForm] = useState({ userId: '' });

  const showToast = (msg: string, type: 'success'|'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  async function loadAll() {
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
  }

  useEffect(() => { loadAll(); }, []);

  const fleetList = Array.isArray(fleet) ? fleet : [];
  const rentalsList = Array.isArray(rentals) ? rentals : [];

  const stats = {
    total:       fleetList.length,
    available:   fleetList.filter(f => f.status === 'AVAILABLE').length,
    rented:      fleetList.filter(f => f.status === 'RENTED').length,
    maintenance: fleetList.filter(f => f.status === 'MAINTENANCE').length,
  };

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/users`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(regForm),
      });
      if (!res.ok) throw new Error(await res.text());
      setShowRegister(false);
      setRegForm({ name:'', phone:'', email:'', role:'CUSTOMER' });
      showToast('User registered successfully!', 'success');
      loadAll();
    } catch (err: unknown) {
      showToast(`Registration failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }

  async function handleRent(e: React.FormEvent) {
    e.preventDefault();
    if (!rentTarget) return;
    try {
      const res = await fetch(`${API}/rentals/checkout`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ userId: String(rentForm.userId), fleetId: String(rentTarget.id) }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Checkout failed');
      }
      setShowRent(false);
      setRentForm({ userId:'' });
      showToast(`${rentTarget.make} ${rentTarget.model} rented successfully! 🚗`, 'success');
      loadAll();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    }
  }

  const activeRentals = rentalsList.filter(r => r.status === 'ACTIVE').slice(0, 5);

  if (loading) return (
    <div className="loading-center" style={{ minHeight: 'calc(100vh - 64px)' }}>
      <div className="spinner" />
      <span>Loading fleet data...</span>
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
            <button className="btn btn-primary" onClick={() => setShowRegister(true)}>
              + Register Client
            </button>
            <Link href="/map" className="btn btn-ghost">
              🗺️ Live Radar Map
            </Link>
          </div>
        </div>

        {/* ── Stats ─────────────────────────────────────────── */}
        <div className="stats-grid">
          {[
            { icon:'🏎️', label:'Total Fleet',   value:stats.total,       color:'#d4af37', stat:'--stat-color:#d4af37' },
            { icon:'✨', label:'Available',     value:stats.available,   color:'#34d399', stat:'--stat-color:#34d399' },
            { icon:'🔑', label:'Active Rentals',value:stats.rented,      color:'#f7e199', stat:'--stat-color:#f7e199' },
            { icon:'⚙️', label:'Service',       value:stats.maintenance, color:'#fbbf24', stat:'--stat-color:#fbbf24' },
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
              <div className="section-subtitle">{fleet.length} vehicles registered</div>
            </div>
            <Link href="/fleet" className="btn btn-ghost btn-sm">View All →</Link>
          </div>

          {fleet.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🚗</div>
              <div className="empty-state-title">No vehicles yet</div>
              <div className="empty-state-desc">Add vehicles via the Fleet page</div>
            </div>
          ) : (
            <div className="fleet-grid">
              {fleet.slice(0,6).map(v => (
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
                  <div className="vehicle-card-footer">
                    {v.status === 'AVAILABLE' ? (
                      <button className="btn btn-success btn-sm"
                        onClick={() => { setRentTarget(v); setShowRent(true); }}>
                        🔑 Rent Now
                      </button>
                    ) : (
                      <button className="btn btn-ghost btn-sm" disabled>
                        {v.status === 'RENTED' ? '🔑 In Use' : '🔧 Maintenance'}
                      </button>
                    )}
                    <Link href="/map" className="btn btn-ghost btn-sm">📍 Track</Link>
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
              <div className="section-subtitle">{activeRentals.length} ongoing rentals</div>
            </div>
            <Link href="/rentals" className="btn btn-ghost btn-sm">Manage →</Link>
          </div>

          {activeRentals.length === 0 ? (
            <div className="empty-state" style={{ padding:'32px' }}>
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">No active rentals</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rental ID</th><th>Vehicle</th><th>User</th>
                    <th>Started</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRentals.map(r => {
                    const v = fleet.find(f => f.id === r.fleetId);
                    const u = users.find(u => u.id === r.userId);
                    return (
                      <tr key={r.id}>
                        <td className="primary">#{r.id}</td>
                        <td className="primary">{v ? `${v.make} ${v.model}` : `Fleet #${r.fleetId}`}</td>
                        <td>{u?.name ?? `User #${r.userId}`}</td>
                        <td>{new Date(r.startTime).toLocaleString()}</td>
                        <td><StatusBadge status={r.status} /></td>
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
            <div className="modal-title">Register New User</div>
            <div className="modal-subtitle">Add a customer, driver, or admin to the platform</div>
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-control" required placeholder="John Doe"
                  value={regForm.name} onChange={e => setRegForm({...regForm, name:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-control" required placeholder="+1-555-0000"
                  value={regForm.phone} onChange={e => setRegForm({...regForm, phone:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-control" type="email" required placeholder="john@example.com"
                  value={regForm.email} onChange={e => setRegForm({...regForm, email:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-control"
                  value={regForm.role} onChange={e => setRegForm({...regForm, role:e.target.value})}>
                  <option value="CUSTOMER">Customer</option>
                  <option value="DRIVER">Driver</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowRegister(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Register</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Rent Vehicle Modal ────────────────────────────── */}
      {showRent && rentTarget && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowRent(false)}>
          <div className="modal">
            <div className="modal-title">Rent Vehicle</div>
            <div className="modal-subtitle">
              {TYPE_EMOJI[rentTarget.type]} {rentTarget.make} {rentTarget.model} — ${rentTarget.dailyRate?.toFixed(2)}/day
            </div>
            <form onSubmit={handleRent}>
              <div className="form-group">
                <label className="form-label">Select Customer</label>
                <select className="form-control" required
                  value={rentForm.userId} onChange={e => setRentForm({...rentForm, userId:e.target.value})}>
                  <option value="">Choose a user...</option>
                  {users.filter(u => u.role === 'CUSTOMER').map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.phone})</option>
                  ))}
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowRent(false)}>Cancel</button>
                <button type="submit" className="btn btn-success">🔑 Confirm Rental</button>
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
