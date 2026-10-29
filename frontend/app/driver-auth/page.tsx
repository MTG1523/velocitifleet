'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function DriverAuthContent() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect_url') || 'velocitifleet-driver://login';

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleComplete = (userEmail: string, userName: string) => {
    setSubmitting(true);
    const finalEmail = userEmail || 'driver@gmail.com';
    const finalName = userName || finalEmail.split('@')[0];

    // Construct return redirect
    const hasParams = redirectUrl.includes('?');
    const returnTarget = `${redirectUrl}${hasParams ? '&' : '?'}email=${encodeURIComponent(finalEmail)}&name=${encodeURIComponent(finalName)}&provider=google`;

    window.location.href = returnTarget;
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#070709',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#fff',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        backgroundColor: '#121217',
        border: '1.5px solid rgba(212,175,55,0.3)',
        borderRadius: '24px',
        padding: '30px 24px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.8), 0 0 24px rgba(212,175,55,0.15)',
        textAlign: 'center',
      }}>
        {/* Brand */}
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '20px',
          background: 'rgba(212,175,55,0.12)',
          border: '2px solid #d4af37',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
          margin: '0 auto 16px',
        }}>
          👑
        </div>

        <h1 style={{ fontSize: '22px', fontWeight: 900, margin: '0 0 6px', letterSpacing: '1px' }}>
          VELOCITI<span style={{ color: '#d4af37' }}>DRIVER</span>
        </h1>
        <p style={{ fontSize: '13px', color: 'rgba(248,244,235,0.6)', margin: '0 0 24px' }}>
          Google Driver Authentication Bridge
        </p>

        {/* Google Form */}
        <div style={{ textAlign: 'left', marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: 'rgba(248,244,235,0.7)', fontWeight: 700, marginBottom: '6px' }}>
            Your Google Account Email
          </label>
          <input
            type="email"
            placeholder="your.email@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: '#0c0c10',
              border: '1px solid rgba(212,175,55,0.3)',
              borderRadius: '12px',
              padding: '12px 14px',
              color: '#fff',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
              marginBottom: '14px',
            }}
          />

          <label style={{ display: 'block', fontSize: '12px', color: 'rgba(248,244,235,0.7)', fontWeight: 700, marginBottom: '6px' }}>
            Driver Display Name
          </label>
          <input
            type="text"
            placeholder="e.g. Carlos Diaz"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: '#0c0c10',
              border: '1px solid rgba(212,175,55,0.3)',
              borderRadius: '12px',
              padding: '12px 14px',
              color: '#fff',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => handleComplete(email, name)}
          disabled={submitting}
          style={{
            width: '100%',
            backgroundColor: '#ffffff',
            color: '#1f2937',
            border: 'none',
            borderRadius: '14px',
            padding: '14px 20px',
            fontSize: '15px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            marginBottom: '16px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
          }}
        >
          <span style={{ fontSize: '18px', color: '#4285F4', fontWeight: 900 }}>G</span>
          <span>{submitting ? 'Authenticating...' : 'Sign In with Google Account'}</span>
        </button>

        <div style={{ fontSize: '11px', color: 'rgba(248,244,235,0.4)', lineHeight: 1.5 }}>
          Your Google credentials will be authenticated with the central VelocitiFleet radar.
        </div>
      </div>
    </div>
  );
}

export default function DriverAuthPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', backgroundColor: '#070709', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d4af37' }}>
        Loading authentication bridge...
      </div>
    }>
      <DriverAuthContent />
    </Suspense>
  );
}
