'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

interface Fleet {
  id: number; make: string; model: string; type: string;
  registration: string; status: string; year: number; dailyRate: number; imageUrl: string|null;
}
interface User {
  id: number | string; name: string; phone: string; email: string; role: string;
}
interface Rental {
  id: number | string; userId: number | string; fleetId: number | string; status: string;
}

const TYPE_EMOJI: Record<string, string> = {
  Car:'🚗', Scooter:'🛵', Motorcycle:'🏍️', Truck:'🚛', Van:'🚐',
};

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status.toLowerCase()}`}><span className="badge-dot"/>{status}</span>;
}

export default function FleetPage() {
  const { user } = useAuth();
  const [fleet,    setFleet]   = useState<Fleet[]>([]);
  const [users,    setUsers]   = useState<User[]>([]);
  const [rentals,  setRentals] = useState<Rental[]>([]);
  const [loading,  setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [showAdd,  setShowAdd] = useState(false);
  const [showRent, setShowRent] = useState(false);
  const [rentTarget, setRentTarget] = useState<Fleet | null>(null);
  const [rentUserId, setRentUserId] = useState('');

  const [filter,   setFilter]  = useState<string>('ALL');
  const [toast,    setToast]   = useState<{msg:string; type:'success'|'error'}|null>(null);
  const [addForm,  setAddForm] = useState({
    make:'', model:'', type:'Car', registration:'', year:'', dailyRate:'', status:'AVAILABLE',
  });

  const showToast = (msg: string, type: 'success'|'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const load = useCallback(async () => {
    try {
      const [f, u, r] = await Promise.all([
        fetch(`${API}/fleet`).then(res => res.ok ? res.json() : []).catch(() => []),
        fetch(`${API}/users`).then(res => res.ok ? res.json() : []).catch(() => []),
        fetch(`${API}/rentals`).then(res => res.ok ? res.json() : []).catch(() => []),
      ]);
      setFleet(Array.isArray(f) ? f : []);
      setUsers(Array.isArray(u) ? u : []);
      setRentals(Array.isArray(r) ? r : []);
    } catch { showToast('Failed to load fleet data', 'error'); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/fleet`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          ...addForm,
          year: addForm.year ? parseInt(addForm.year) : null,
          dailyRate: addForm.dailyRate ? parseFloat(addForm.dailyRate) : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add vehicle');
      }
      setShowAdd(false);
      setAddForm({ make:'', model:'', type:'Car', registration:'', year:'', dailyRate:'', status:'AVAILABLE' });
      showToast('Vehicle added to fleet successfully! 🚗', 'success');
      load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStatusChange(id: number, status: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/fleet/${id}/status?status=${status}`, { method:'PATCH' });
      if (!res.ok) throw new Error('Status update failed');
      showToast(`Vehicle #${id} status updated to ${status}`, 'success');
      load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update status', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to remove this vehicle from the fleet?')) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/fleet/${id}`, { method:'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      showToast('Vehicle removed from fleet', 'success');
      load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setActionLoading(false);
    }
  }

  // Quick rent from fleet card
  async function handleRentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rentTarget) return;

    const chosenUserId = rentUserId || (user ? (user.dbId || user.uid) : '');
    if (!chosenUserId) {
      showToast('Please select a customer to rent', 'error');
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
      setRentTarget(null);
      setRentUserId('');
      showToast(`${rentTarget.make} ${rentTarget.model} rented successfully! 🔑`, 'success');
      load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setActionLoading(false);
    }
  }

  // Quick return for rented vehicle
  async function handleReturnVehicle(fleetId: number) {
    const activeRental = rentals.find(r => String(r.fleetId) === String(fleetId) && r.status === 'ACTIVE');
    if (activeRental) {
      setActionLoading(true);
      try {
        const res = await fetch(`${API}/rentals/${activeRental.id}/complete`, { method:'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to complete rental');
        showToast(`Vehicle returned and rental settled! Cost: $${data.totalCost?.toFixed(2) ?? '0.00'}`, 'success');
        load();
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : String(err), 'error');
      } finally {
        setActionLoading(false);
      }
    } else {
      await handleStatusChange(fleetId, 'AVAILABLE');
    }
  }

  const fleetList = Array.isArray(fleet) ? fleet : [];
  const displayed = filter === 'ALL' ? fleetList : fleetList.filter(f => f.status === filter);

  if (loading) return (
    <div className="loading-center" style={{ minHeight:'calc(100vh - 64px)' }}>
      <div className="spinner" />
      <span>Loading fleet inventory...</span>
    </div>
  );

  return (
    <div className="page">
      <div className="container">

        <div className="page-hero">
          <div className="page-hero-badge">✦ PREMIER FLEET ROSTER</div>
          <h1 className="page-title">Executive <span>Fleet Inventory</span></h1>
          <p className="page-desc">Oversee, configure, and monitor luxury vehicles across your global fleet in Chennai.</p>
        </div>

        {/* ── Controls ─────────────────────────────────── */}
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'24px', alignItems:'center' }}>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)} id="fleet-add-btn">
            + Add Vehicle
          </button>
          {['ALL','AVAILABLE','RENTED','MAINTENANCE'].map(s => (
            <button key={s} className="btn btn-ghost btn-sm"
              style={filter===s ? { borderColor:'var(--accent-gold)', color:'var(--accent-gold-light)', background:'rgba(212,175,55,0.14)', boxShadow:'0 0 12px rgba(212,175,55,0.2)' } : {}}
              onClick={() => setFilter(s)}>{s}</button>
          ))}
          <span style={{ marginLeft:'auto', fontSize:'0.82rem', color:'var(--accent-gold-light)', fontWeight:600 }}>
            {displayed.length} of {fleetList.length} vehicles
          </span>
        </div>

        {/* ── Fleet Grid ────────────────────────────────── */}
        {displayed.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🚗</div>
            <div className="empty-state-title">No vehicles found in &quot;{filter}&quot;</div>
            <div className="empty-state-desc">Click &quot;+ Add Vehicle&quot; or switch category filters above</div>
          </div>
        ) : (
          <div className="fleet-grid">
            {displayed.map(v => (
              <div key={v.id} className="vehicle-card">
                <div className="vehicle-card-header">
                  <div className="vehicle-icon-wrap" style={{ fontSize:'1.8rem' }}>
                    {TYPE_EMOJI[v.type] ?? '🚗'}
                  </div>
                  <StatusBadge status={v.status} />
                </div>
                <div className="vehicle-card-body">
                  <div className="vehicle-make">{v.make}</div>
                  <div className="vehicle-name">{v.model}</div>
                  <div style={{ marginTop:'4px' }}>
                    <span className="vehicle-reg">{v.registration}</span>
                  </div>
                  <div className="vehicle-meta" style={{ marginTop:'14px' }}>
                    <div className="vehicle-meta-item">
                      <span className="vehicle-meta-label">Type</span>
                      <span className="vehicle-meta-value">{v.type}</span>
                    </div>
                    <div className="vehicle-meta-item">
                      <span className="vehicle-meta-label">Year</span>
                      <span className="vehicle-meta-value">{v.year ?? '—'}</span>
                    </div>
                    <div className="vehicle-meta-item">
                      <span className="vehicle-meta-label">Rate</span>
                      <span className="vehicle-meta-value" style={{ color:'var(--accent-gold)' }}>
                        ${v.dailyRate?.toFixed(2) ?? '—'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="vehicle-card-footer" style={{ flexWrap:'wrap', gap:'6px' }}>
                  {v.status === 'AVAILABLE' && (
                    <>
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={() => {
                          setRentTarget(v);
                          setRentUserId(user ? String(user.dbId || user.uid) : '');
                          setShowRent(true);
                        }}
                      >
                        🔑 Rent
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleStatusChange(v.id, 'MAINTENANCE')}
                        disabled={actionLoading}
                      >
                        🔧 Service
                      </button>
                    </>
                  )}

                  {v.status === 'RENTED' && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleReturnVehicle(v.id)}
                      disabled={actionLoading}
                    >
                      ✓ Complete Return
                    </button>
                  )}

                  {v.status === 'MAINTENANCE' && (
                    <button
                      type="button"
                      className="btn btn-success btn-sm"
                      onClick={() => handleStatusChange(v.id, 'AVAILABLE')}
                      disabled={actionLoading}
                    >
                      ✅ Mark Available
                    </button>
                  )}

                  <Link
                    href={`/map?vehicle=${v.id}`}
                    className="btn btn-ghost btn-sm"
                    title="Track on live radar"
                  >
                    📍 Track
                  </Link>

                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(v.id)}
                    title="Delete vehicle"
                    disabled={actionLoading}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add Vehicle Modal ──────────────────────────── */}
      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div className="modal-title">Add Vehicle to Fleet</div>
                <div className="modal-subtitle">Register a new vehicle into the Chennai fleet</div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding:'4px 8px', fontSize:'1rem', lineHeight:1 }}
                onClick={() => setShowAdd(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAdd}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div className="form-group">
                  <label className="form-label">Make</label>
                  <input className="form-control" required placeholder="Porsche"
                    value={addForm.make} onChange={e => setAddForm({...addForm, make:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Model</label>
                  <input className="form-control" required placeholder="Taycan Turbo"
                    value={addForm.model} onChange={e => setAddForm({...addForm, model:e.target.value})} />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-control"
                    value={addForm.type} onChange={e => setAddForm({...addForm, type:e.target.value})}>
                    {['Car','Scooter','Motorcycle','Truck','Van'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Registration Plate</label>
                  <input className="form-control" required placeholder="TN-01-VF-999"
                    value={addForm.registration} onChange={e => setAddForm({...addForm, registration:e.target.value})} />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div className="form-group">
                  <label className="form-label">Year</label>
                  <input className="form-control" type="number" placeholder="2026"
                    value={addForm.year} onChange={e => setAddForm({...addForm, year:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Daily Rate ($)</label>
                  <input className="form-control" type="number" step="0.01" placeholder="150.00"
                    value={addForm.dailyRate} onChange={e => setAddForm({...addForm, dailyRate:e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : 'Add to Fleet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Quick Rent Modal ────────────────────────────── */}
      {showRent && rentTarget && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowRent(false)}>
          <div className="modal">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div className="modal-title">Rent Vehicle</div>
                <div className="modal-subtitle">
                  {TYPE_EMOJI[rentTarget.type]} {rentTarget.make} {rentTarget.model} ({rentTarget.registration}) — ${rentTarget.dailyRate?.toFixed(2)}/day
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
            <form onSubmit={handleRentSubmit}>
              <div className="form-group">
                <label className="form-label">Select Client / Charter Account</label>
                <select
                  className="form-control"
                  required
                  value={rentUserId}
                  onChange={e => setRentUserId(e.target.value)}
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

      {/* ── Toast ─────────────────────────────────────── */}
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
