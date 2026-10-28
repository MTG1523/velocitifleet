'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWebSocket } from '@/hooks/useVehicleTracker';
import { useAuth } from '@/context/AuthContext';

export default function Navbar() {
  const pathname = usePathname();
  const { status } = useWebSocket();
  const { user, signOut } = useAuth();

  const wsLabel =
    status === 'connected'  ? 'Live Radar'       :
    status === 'connecting' ? 'Connecting...'    :
    status === 'error'      ? 'Link Error'       : 'Offline';

  return (
    <nav className="navbar">
      <div className="container">
        <Link href="/" className="navbar-brand" title="VelocitiFleet Home">
          <span className="brand-text">Velociti<span>Fleet</span></span>
        </Link>

        <div className="navbar-nav">
          <Link href="/"         className={`nav-link ${pathname === '/'         ? 'active' : ''}`}>Dashboard</Link>
          <Link href="/map"      className={`nav-link ${pathname === '/map'      ? 'active' : ''}`}>Live Map</Link>
          <Link href="/rentals"  className={`nav-link ${pathname === '/rentals'  ? 'active' : ''}`}>Rentals</Link>
          <Link href="/fleet"    className={`nav-link ${pathname === '/fleet'    ? 'active' : ''}`}>Fleet</Link>
          {user && (
            <Link href="/account" className={`nav-link ${pathname === '/account'  ? 'active' : ''}`}>Account</Link>
          )}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <div className="ws-indicator">
            <div className={`ws-dot ${status}`} />
            <span>{wsLabel}</span>
          </div>

          {user ? (
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <Link href="/account" className="user-nav-badge" title="Manage Account Profile">
                <span className="user-nav-name">
                  {user.displayName || user.email?.split('@')[0] || 'Executive'}
                </span>
                <span style={{ fontSize:'0.75rem' }}>👑</span>
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="btn btn-ghost btn-sm nav-signout-btn"
                title="Sign Out"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className={`btn btn-sm ${pathname === '/login' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding:'6px 14px', fontSize:'0.82rem' }}
            >
              Sign In →
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

