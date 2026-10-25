'use client';

import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

interface Fleet {
  id: number; make: string; model: string; type: string;
  registration: string; status: string; dailyRate: number;
}
interface User  { id: number; name: string; phone: string; email: string; }
interface Rental {
  id: number; userId: number; fleetId: number; startTime: string;
  endTime: string|null; status: string; totalCost: number|null;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status.toLowerCase()}`}><span className="badge-dot"/>{status}</span>;
}

export default function RentalsPage() {
  const [rentals,  setRentals]  = useState<Rental[]>([]);
  const [fleet,    setFleet]    = useState<Fleet[]>([]);
  const [users,    setUsers]    = useState<User[]>([]);
  const [loading,  setLoading]  = useState(true);
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
        fetch(`${API}/rentals`).then(r=>r.json()),
        fetch(`${API}/fleet`).then(r=>r.json()),
        fetch(`${API}/users`).then(r=>r.json()),
      ]);
      setRentals(r); setFleet(f); setUsers(u);
    } catch { showToast('Failed to load — check backend connection', 'error'); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/rentals/checkout`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ userId: parseInt(newForm.userId), fleetId: parseInt(newForm.fleetId) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      setShowNew(false);
      setNewForm({ userId:'', fleetId:'' });
      showToast('Rental started successfully!', 'success');
      loadAll();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    }
  }

  async function handleComplete(rentalId: number) {
    try {
      const res = await fetch(`${API}/rentals/${rentalId}/complete`, { method:'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to complete rental');
      showToast(`Rental #${rentalId} completed. Cost: $${data.totalCost?.toFixed(2) ?? '—'}`, 'success');
      loadAll();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    }
  }

  const availableFleet  = fleet.filter(f => f.status === 'AVAILABLE');
  const filteredRentals = filter === 'ALL' ? rentals : rentals.filter(r => r.status === filter);

  if (loading) return (
    <div className="loading-center" style={{ minHeight:'calc(100vh - 64px)' }}>
      <div className="spinner" />
      <span>Loading rentals...</span>
    </div>
  );

  return (
    <div className="page">
      <div className="container">

        <div className="page-hero">
          <div className="page-hero-badge">📋 Rental Management</div>
          <h1 className="page-title">Rentals & <span>Billing</span></h1>
          <p className="page-desc">
            Process checkouts, complete rentals, and view full rental history.
          </p>
        </div>

        {/* ── Controls ──────────────────────────────────── */}
        <div style={{ display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap', marginBottom:'24px' }}>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New Rental</button>
          {(['ALL','ACTIVE','COMPLETED'] as const).map(f => (
            <button key={f} className={`btn btn-ghost btn-sm ${filter===f ? 'active' : ''}`}
              style={filter===f ? { borderColor:'var(--accent-blue)', color:'var(--accent-blue)' } : {}}
              onClick={() => setFilter(f)}>{f}</button>
          ))}
          <span style={{ marginLeft:'auto', fontSize:'0.8rem', color:'var(--text-muted)' }}>
            {filteredRentals.length} rentals
          </span>
        </div>

        {/* ── Rentals Table ─────────────────────────────── */}
        {filteredRentals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No {filter === 'ALL' ? '' : filter.toLowerCase() + ' '}rentals</div>
            <div className="empty-state-desc">Click &quot;+ New Rental&quot; to get started</div>
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
                  const v = fleet.find(f => f.id === r.fleetId);
                  const u = users.find(u => u.id === r.userId);
                  return (
                    <tr key={r.id}>
                      <td className="primary">#{r.id}</td>
                      <td className="primary">
                        {v ? `${v.make} ${v.model}` : `Fleet #${r.fleetId}`}
                        {v && <span style={{ fontSize:'0.72rem', color:'var(--text-dim)', display:'block' }}>{v.registration}</span>}
                      </td>
                      <td>
                        {u?.name ?? `User #${r.userId}`}
                        {u && <span style={{ fontSize:'0.72rem', color:'var(--text-dim)', display:'block' }}>{u.phone}</span>}
                      </td>
                      <td>{new Date(r.startTime).toLocaleString()}</td>
                      <td>{r.endTime ? new Date(r.endTime).toLocaleString() : <span style={{ color:'var(--text-dim)' }}>—</span>}</td>
                      <td style={{ color:'var(--accent-green)', fontWeight:600 }}>
                        {r.totalCost != null ? `$${r.totalCost.toFixed(2)}` : <span style={{ color:'var(--text-dim)' }}>—</span>}
                      </td>
                      <td><StatusBadge status={r.status} /></td>
                      <td>
                        {r.status === 'ACTIVE' && (
                          <button className="btn btn-danger btn-sm"
                            onClick={() => handleComplete(r.id)}>
                            ✓ Complete
                          </button>
                        )}
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
            <div className="modal-title">New Rental Checkout</div>
            <div className="modal-subtitle">
              Select a customer and an available vehicle to begin the rental
            </div>
            <form onSubmit={handleCheckout}>
              <div className="form-group">
                <label className="form-label">Customer</label>
                <select className="form-control" required
                  value={newForm.userId} onChange={e => setNewForm({...newForm, userId:e.target.value})}>
                  <option value="">Choose customer...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} — {u.phone}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Vehicle</label>
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
                  ⚠️ No vehicles currently available
                </p>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
                <button type="submit" className="btn btn-success" disabled={availableFleet.length === 0}>
                  🔑 Checkout
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
