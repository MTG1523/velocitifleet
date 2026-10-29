'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

interface Fleet {
  id: number; make: string; model: string; type: string;
  registration: string; status: string; dailyRate: number;
}
interface User  { id: number | string; name: string; phone: string; email: string; role?: string; }
interface Rental {
  id: number | string; userId: number | string; fleetId: number | string; startTime: string;
  endTime: string|null; status: string; totalCost: number|null;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status.toLowerCase()}`}><span className="badge-dot"/>{status}</span>;
}

export default function RentalsPage() {
  const { user } = useAuth();
  const [rentals,  setRentals]  = useState<Rental[]>([]);
  const [fleet,    setFleet]    = useState<Fleet[]>([]);
  const [users,    setUsers]    = useState<User[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [newForm,  setNewForm]  = useState({ userId:'', fleetId:'' });
  const [toast,    setToast]    = useState<{msg:string; type:'success'|'error'}|null>(null);
  const [filter,   setFilter]   = useState<'ALL'|'ACTIVE'|'COMPLETED'>('ALL');

  const showToast = (msg: string, type: 'success'|'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAll = useCallback(async () => {
    try {
      const [r, f, u] = await Promise.all([
        fetch(`${API}/rentals`).then(res => res.ok ? res.json() : []).catch(() => []),
        fetch(`${API}/fleet`).then(res => res.ok ? res.json() : []).catch(() => []),
        fetch(`${API}/users`).then(res => res.ok ? res.json() : []).catch(() => []),
      ]);
      setRentals(Array.isArray(r) ? r : []);
      setFleet(Array.isArray(f) ? f : []);
      setUsers(Array.isArray(u) ? u : []);
    } catch { showToast('Failed to load rentals — check backend connection', 'error'); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    const chosenUserId = newForm.userId || (user ? (user.dbId || user.uid) : '');
    if (!chosenUserId) {
      showToast('Please select a customer', 'error');
      return;
    }
    if (!newForm.fleetId) {
      showToast('Please select an available vehicle', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`${API}/rentals/checkout`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ userId: String(chosenUserId), fleetId: String(newForm.fleetId) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      setShowNew(false);
      setNewForm({ userId:'', fleetId:'' });
      showToast('Rental charter started successfully! 🚗', 'success');
      loadAll();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleComplete(rentalId: number | string) {
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/rentals/${rentalId}/complete`, { method:'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to complete rental');
      showToast(`Rental #${rentalId} completed & returned. Total: $${data.totalCost?.toFixed(2) ?? '0.00'}`, 'success');
      loadAll();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setActionLoading(false);
    }
  }

  const fleetList = Array.isArray(fleet) ? fleet : [];
  const rentalsList = Array.isArray(rentals) ? rentals : [];
  const availableFleet  = fleetList.filter(f => f.status === 'AVAILABLE');
  const filteredRentals = filter === 'ALL' ? rentalsList : rentalsList.filter(r => r.status === filter);

  if (loading) return (
    <div className="loading-center" style={{ minHeight:'calc(100vh - 64px)' }}>
      <div className="spinner" />
      <span>Loading rentals ledger...</span>
    </div>
  );

  return (
    <div className="page">
      <div className="container">

        <div className="page-hero">
          <div className="page-hero-badge">✦ PREMIER LEASING & CHARTERS</div>
          <h1 className="page-title">Rentals & <span>Billing Ledger</span></h1>
          <p className="page-desc">
            Process luxury vehicle checkouts, finalize concierge charters, and view lifetime account history in Chennai.
          </p>
        </div>

        {/* ── Controls ──────────────────────────────────── */}
        <div style={{ display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap', marginBottom:'24px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setNewForm({ userId: user ? String(user.dbId || user.uid) : '', fleetId: availableFleet[0]?.id ? String(availableFleet[0].id) : '' });
              setShowNew(true);
            }}
            id="rentals-new-btn"
          >
            + New Rental
          </button>
          {(['ALL','ACTIVE','COMPLETED'] as const).map(f => (
            <button key={f} className={`btn btn-ghost btn-sm ${filter===f ? 'active' : ''}`}
              style={filter===f ? { borderColor:'var(--accent-gold)', color:'var(--accent-gold-light)', background:'rgba(212,175,55,0.14)', boxShadow:'0 0 12px rgba(212,175,55,0.2)' } : {}}
              onClick={() => setFilter(f)}>{f}</button>
          ))}
          <span style={{ marginLeft:'auto', fontSize:'0.82rem', color:'var(--accent-gold-light)', fontWeight:600 }}>
            {filteredRentals.length} of {rentalsList.length} records
          </span>
        </div>

        {/* ── Rentals Table ─────────────────────────────── */}
        {filteredRentals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No {filter === 'ALL' ? '' : filter.toLowerCase() + ' '}rentals found</div>
            <div className="empty-state-desc">Click &quot;+ New Rental&quot; to begin a luxury charter</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Vehicle</th>
                  <th>Customer</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Cost</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRentals.map(r => {
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
                        {u?.name ?? (user ? `${user.displayName} (Me)` : `User #${r.userId}`)}
                        {u && <span style={{ fontSize:'0.72rem', color:'var(--text-dim)', display:'block' }}>{u.phone}</span>}
                      </td>
                      <td>{new Date(r.startTime).toLocaleString()}</td>
                      <td>{r.endTime ? new Date(r.endTime).toLocaleString() : <span style={{ color:'var(--text-dim)' }}>In Progress</span>}</td>
                      <td style={{ color:'var(--accent-green)', fontWeight:600 }}>
                        {r.totalCost != null ? `$${r.totalCost.toFixed(2)}` : <span style={{ color:'var(--text-dim)' }}>—</span>}
                      </td>
                      <td><StatusBadge status={r.status} /></td>
                      <td>
                        <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                          {r.status === 'ACTIVE' && (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              style={{ padding:'4px 10px', fontSize:'0.75rem' }}
                              onClick={() => handleComplete(r.id)}
                              disabled={actionLoading}
                            >
                              ✓ Complete
                            </button>
                          )}
                          <Link
                            href={`/map?vehicle=${r.fleetId}`}
                            className="btn btn-ghost btn-sm"
                            style={{ padding:'4px 10px', fontSize:'0.75rem' }}
                            title="Track vehicle on radar"
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

      {/* ── New Rental Modal ───────────────────────────── */}
      {showNew && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowNew(false)}>
          <div className="modal">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div className="modal-title">New Rental Checkout</div>
                <div className="modal-subtitle">
                  Select a customer and an available vehicle to begin the charter
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding:'4px 8px', fontSize:'1rem', lineHeight:1 }}
                onClick={() => setShowNew(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCheckout}>
              <div className="form-group">
                <label className="form-label">Client / Charter Account</label>
                <select className="form-control" required
                  value={newForm.userId} onChange={e => setNewForm({...newForm, userId:e.target.value})}>
                  <option value="">Choose customer...</option>
                  {user && (
                    <option value={user.dbId || user.uid}>
                      👑 {user.displayName || user.email} (Current User - {user.tier || 'VIP Elite'})
                    </option>
                  )}
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} — {u.phone}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Available Vehicle</label>
                <select className="form-control" required
                  value={newForm.fleetId} onChange={e => setNewForm({...newForm, fleetId:e.target.value})}>
                  <option value="">Choose vehicle...</option>
                  {availableFleet.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.make} {v.model} ({v.registration}) — ${v.dailyRate?.toFixed(2)}/day
                    </option>
                  ))}
                </select>
              </div>
              {availableFleet.length === 0 && (
                <p style={{ fontSize:'0.82rem', color:'var(--accent-orange)', marginBottom:'8px' }}>
                  ⚠️ No vehicles currently available for rental
                </p>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={availableFleet.length === 0 || actionLoading}
                >
                  {actionLoading ? 'Processing...' : '🔑 Checkout'}
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
