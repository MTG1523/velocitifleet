'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, isConfigured, signInWithGoogle, signInWithDemo, signInWithEmail } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setSubmitting(true);
    try {
      if (!isConfigured) {
        setErrorMsg('Firebase is not yet configured. Please add your credentials to .env.local.');
        return;
      }
      await signInWithGoogle();
      router.push('/');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Google authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setErrorMsg('');
    setSubmitting(true);
    try {
      if (!isConfigured) {
        signInWithDemo(email.split('@')[0] || 'Fleet Client');
        router.push('/');
        return;
      }
      await signInWithEmail(email, password);
      router.push('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('api-key-not-valid') || msg.includes('API key') || msg.includes('auth/')) {
        signInWithDemo(email.split('@')[0] || 'Fleet Client');
        router.push('/');
        return;
      }
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoSignIn = () => {
    signInWithDemo('Fleet Executive');
    router.push('/');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Header */}
        <div className="login-header">
          <div className="login-badge">✦ PREMIER EXECUTIVE ACCESS</div>
          <h1 className="login-title">
            Sign In to <span>VelocitiFleet</span>
          </h1>
          <p className="login-subtitle">
            Access live telemetry radar, luxury vehicle bookings, and fleet operations.
          </p>
        </div>

        {errorMsg && (
          <div className="login-error">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Google Sign In Button */}
        <button
          type="button"
          className="google-btn"
          onClick={handleGoogleSignIn}
          disabled={submitting}
        >
          <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="login-divider">
          <span>or sign in with email</span>
        </div>

        {/* Email / Password Form */}
        <form onSubmit={handleEmailSignIn} className="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="email-input">
              Work Email
            </label>
            <input
              id="email-input"
              type="email"
              className="form-control"
              placeholder="executive@velocitifleet.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password-input">
              Password
            </label>
            <input
              id="password-input"
              type="password"
              className="form-control"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary login-submit-btn"
            disabled={submitting}
          >
            {submitting ? 'Authenticating...' : 'Sign In with Email'}
          </button>
        </form>

        {/* Demo Fallback Box */}
        <div className="demo-login-box">
          <div className="demo-login-info">
            <span className="demo-badge">{isConfigured ? '⚡ INSTANT DEMO' : 'ℹ️ TEST MODE'}</span>
            <p>
              {isConfigured
                ? 'Quick access without entering credentials:'
                : 'Live Google OAuth requires Firebase API keys in .env.local. Click below for instant guest access:'}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm demo-btn"
              onClick={() => {
                signInWithDemo('Alexander Vance (VIP Elite)');
                router.push('/');
              }}
            >
              👑 Instant VIP Executive Access →
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.78rem' }}
                onClick={() => {
                  signInWithDemo('Fleet Operations Manager');
                  router.push('/');
                }}
              >
                💼 Fleet Manager
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.78rem' }}
                onClick={() => {
                  signInWithDemo('Carlos Diaz (Driver)');
                  router.push('/');
                }}
              >
                🚗 Chauffeur Driver
              </button>
            </div>
          </div>
        </div>

        <div className="login-footer">
          <Link href="/" className="login-back-link">
            ← Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
