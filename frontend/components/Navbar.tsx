'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWebSocket } from '@/hooks/useWebSocket';

export default function Navbar() {
  const pathname = usePathname();
  const { status } = useWebSocket();

  const wsLabel =
    status === 'connected'  ? 'Live'       :
    status === 'connecting' ? 'Connecting' :
    status === 'error'      ? 'Error'      : 'Offline';

  return (
    <nav className="navbar">
      <div className="container">
        <Link href="/" className="navbar-brand">
          <div className="brand-icon">⚡</div>
          <span className="brand-text">Velociti<span>Fleet</span></span>
        </Link>

        <div className="navbar-nav">
          <Link href="/"         className={`nav-link ${pathname === '/'         ? 'active' : ''}`}>Dashboard</Link>
          <Link href="/map"      className={`nav-link ${pathname === '/map'      ? 'active' : ''}`}>Live Map</Link>
          <Link href="/rentals"  className={`nav-link ${pathname === '/rentals'  ? 'active' : ''}`}>Rentals</Link>
          <Link href="/fleet"    className={`nav-link ${pathname === '/fleet'    ? 'active' : ''}`}>Fleet</Link>
        </div>

        <div className="ws-indicator">
          <div className={`ws-dot ${status}`} />
          <span>{wsLabel}</span>
        </div>
      </div>
    </nav>
  );
}
