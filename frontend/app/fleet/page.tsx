'use client';

import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

interface Fleet {
  id: number; make: string; model: string; type: string;
  registration: string; status: string; year: number; dailyRate: number; imageUrl: string|null;
}

const TYPE_EMOJI: Record<string, string> = {
  Car:'🚗', Scooter:'🛵', Motorcycle:'🏍️', Truck:'🚛', Van:'🚐',
};
const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: '#00ff88', RENTED: '#00d4ff', MAINTENANCE: '#ff8c42',
};

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status.toLowerCase()}`}><span className="badge-dot"/>{status}</span>;
}

export default function FleetPage() {
  const [fleet,    setFleet]   = useState<Fleet[]>([]);
  const [loading,  setLoading] = useState(true);
  const [showAdd,  setShowAdd] = useState(false);
  const [filter,   setFilter]  = useState<string>('ALL');
  const [toast,    setToast]   = useState<{msg:string; type:'success'|'error'}|null>(null);
  const [addForm,  setAddForm] = useState({
    make:'', model:'', type:'Car', registration:'', year:'', dailyRate:'', status:'AVAILABLE',
  });

  const showToast = (msg: string, type: 'success'|'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    try {
      const data = await fetch(`${API}/fleet`).then(r => r.json());
      setFleet(data);
    } catch { showToast('Failed to load fleet', 'error'); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/fleet`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          ...addForm,
          year: addForm.year ? parseInt(addForm.year) : null,
          dailyRate: addForm.dailyRate ? parseFloat(addForm.dailyRate) : null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setShowAdd(false);
      setAddForm({ make:'', model:'', type:'Car', registration:'', year:'', dailyRate:'', status:'AVAILABLE' });
      showToast('Vehicle added to fleet!', 'success');
      load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    }
  }

  async function handleStatusChange(id: number, status: string) {
    try {
      await fetch(`${API}/fleet/${id}/status?status=${status}`, { method:'PATCH' });
      showToast(`Status updated to ${status}`, 'success');
      load();
    } catch { showToast('Failed to update status', 'error'); }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this vehicle from the fleet?')) return;
    try {
      const res = await fetch(`${API}/fleet/${id}`, { method:'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      showToast('Vehicle removed from fleet', 'success');
      load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    }
  }

  const displayed = filter === 'ALL' ? fleet : fleet.filter(f => f.status === filter);

  if (loading) return (
    <div className="loading-center" style={{ minHeight:'calc(100vh - 64px)' }}>
      <div className="spinner" />
      <span>Loading fleet...</span>
    </div>
  );

  return (
    <div className="page">
      <div className="container">

        <div className="page-hero">
          <div className="page-hero-badge">🚗 Fleet Management</div>
          <h1 className="page-title">Manage Your <span>Fleet</span></h1>
          <p className="page-desc">Add, update, and monitor all vehicles in your fleet.</p>
        </div>

        {/* ── Controls ─────────────────────────────────── */}
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'24px', alignItems:'center' }}>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Vehicle</button>
          {['ALL','AVAILABLE','RENTED','MAINTENANCE'].map(s => (
            <button key={s} className="btn btn-ghost btn-sm"
              style={filter===s ? { borderColor:'var(--accent-blue)', color:'var(--accent-blue)' } : {}}
              onClick={() => setFilter(s)}>{s}</button>
          ))}
          <span style={{ marginLeft:'auto', fontSize:'0.8rem', color:'var(--text-muted)' }}>
            {displayed.length} vehicles
          </span>
        </div>

        {/* ── Fleet Grid ────────────────────────────────── */}
        {displayed.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🚗</div>
            <div className="empty-state-title">No vehicles</div>
            <div className="empty-state-desc">Click &quot;+ Add Vehicle&quot; to get started</div>
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
                      <span className="vehicle-meta-value" style={{ color:'var(--accent-blue)' }}>
                        ${v.dailyRate?.toFixed(2) ?? '—'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="vehicle-card-footer" style={{ flexWrap:'wrap', gap:'6px' }}>
                  {v.status !== 'MAINTENANCE' && (
                    <button className="btn btn-ghost btn-sm"
                      onClick={() => handleStatusChange(v.id, 'MAINTENANCE')}>
                      🔧 Maintenance
                    </button>
                  )}
                  {v.status === 'MAINTENANCE' && (
                    <button className="btn btn-success btn-sm"
                      onClick={() => handleStatusChange(v.id, 'AVAILABLE')}>
                      ✅ Mark Available
                    </button>
                  )}
                  <button className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(v.id)}>
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
            <div className="modal-title">Add Vehicle to Fleet</div>
            <div className="modal-subtitle">Register a new vehicle in the system</div>
            <form onSubmit={handleAdd}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div className="form-group">
                  <label className="form-label">Make</label>
                  <input className="form-control" required placeholder="Toyota"
                    value={addForm.make} onChange={e => setAddForm({...addForm, make:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Model</label>
                  <input className="form-control" required placeholder="Corolla"
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
                  <label className="form-label">Registration</label>
                  <input className="form-control" required placeholder="VF-009"
                    value={addForm.registration} onChange={e => setAddForm({...addForm, registration:e.target.value})} />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div className="form-group">
                  <label className="form-label">Year</label>
                  <input className="form-control" type="number" placeholder="2024"
                    value={addForm.year} onChange={e => setAddForm({...addForm, year:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Daily Rate ($)</label>
                  <input className="form-control" type="number" step="0.01" placeholder="65.00"
                    value={addForm.dailyRate} onChange={e => setAddForm({...addForm, dailyRate:e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add to Fleet</button>
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
