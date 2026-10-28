'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { clientAuth, googleProvider, isFirebaseAuthConfigured } from '@/lib/firebase-client';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  phone?: string | null;
  role?: string;
  tier?: string;
  dbId?: string;
  isDemo?: boolean;
  memberSince?: string;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  isConfigured: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithDemo: (role?: string) => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  updateUserProfile: (details: { displayName?: string; phone?: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isConfigured: false,
  signInWithGoogle: async () => {},
  signInWithDemo: async () => {},
  signInWithEmail: async () => {},
  updateUserProfile: async () => {},
  signOut: async () => {},
});

async function syncWithBackend(rawUser: Partial<AppUser>): Promise<AppUser> {
  try {
    const res = await fetch('/api/users/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: rawUser.uid,
        email: rawUser.email,
        name: rawUser.displayName,
        photoURL: rawUser.photoURL,
        phone: rawUser.phone,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        ...rawUser,
        uid: data.uid || rawUser.uid || 'usr_demo',
        email: data.email || rawUser.email,
        displayName: data.name || rawUser.displayName,
        photoURL: data.photoURL || rawUser.photoURL,
        phone: data.phone || rawUser.phone || '+1 (555) 0199',
        role: data.role || 'EXECUTIVE_VIP',
        tier: data.tier || 'Black Gold Elite',
        dbId: data.id,
        memberSince: data.createdAt ? new Date(data.createdAt).toLocaleDateString('en-US', { month:'short', year:'numeric' }) : 'Oct 2026',
      } as AppUser;
    }
  } catch (err) {
    console.warn('[AuthContext] Backend sync fallback:', err);
  }
  return {
    ...rawUser,
    uid: rawUser.uid || 'usr_demo',
    email: rawUser.email,
    displayName: rawUser.displayName || 'Executive Member',
    photoURL: rawUser.photoURL,
    phone: rawUser.phone || '+1 (555) 0199',
    role: rawUser.role || 'EXECUTIVE_VIP',
    tier: rawUser.tier || 'Black Gold Elite',
    memberSince: 'Oct 2026',
  } as AppUser;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const isConfigured = isFirebaseAuthConfigured();

  const handleSetUser = useCallback(async (newUser: Partial<AppUser> | null) => {
    if (!newUser) {
      setUser(null);
      if (typeof window !== 'undefined') localStorage.removeItem('vf_demo_user');
      return;
    }
    const synced = await syncWithBackend(newUser);
    setUser(synced);
    if (typeof window !== 'undefined') {
      localStorage.setItem('vf_demo_user', JSON.stringify(synced));
    }
  }, []);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('vf_demo_user') : null;
    if (saved) {
      try {
        setUser(JSON.parse(saved));
        setLoading(false);
      } catch {
        localStorage.removeItem('vf_demo_user');
      }
    }

    if (!isConfigured || !clientAuth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(clientAuth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        await handleSetUser({
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName,
          photoURL: fbUser.photoURL,
        });
      } else {
        // If not in demo mode, clear user
        if (!saved) {
          setUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isConfigured, handleSetUser]);

  const signInWithGoogle = async () => {
    if (!isConfigured || !clientAuth) {
      throw new Error('Firebase credentials are not configured.');
    }
    try {
      const result = await signInWithPopup(clientAuth, googleProvider);
      if (result.user) {
        await handleSetUser({
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
        });
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const msg = err instanceof Error ? err.message : String(err);

      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // User closed popup without selecting an account — do not throw harsh error
        return;
      }
      if (code === 'auth/operation-not-allowed') {
        throw new Error(
          'Google Sign-in is not enabled in Firebase Console yet. Please go to Authentication → Sign-in method in Firebase Console and enable Google.'
        );
      }
      if (code === 'auth/unauthorized-domain') {
        throw new Error(
          'This domain is not authorized in Firebase Console. Add localhost under Authentication → Settings → Authorized domains.'
        );
      }
      throw new Error(msg);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    if (!isConfigured || !clientAuth) {
      await signInWithDemo(email.split('@')[0] || 'Fleet Client');
      return;
    }
    try {
      const result = await signInWithEmailAndPassword(clientAuth, email, pass);
      if (result.user) {
        await handleSetUser({
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('api-key-not-valid') || msg.includes('API key') || msg.includes('auth/')) {
        await signInWithDemo(email.split('@')[0] || 'Fleet Client');
        return;
      }
      throw err;
    }
  };

  const signInWithDemo = async (role = 'Fleet Executive') => {
    const demoUser: AppUser = {
      uid: 'google-uid-executive-888',
      email: 'executive@velocitifleet.com',
      displayName: role,
      photoURL: null,
      phone: '+1 (555) 0199',
      role: 'EXECUTIVE_VIP',
      tier: 'Black Gold Elite',
      isDemo: true,
    };
    await handleSetUser(demoUser);
  };

  const updateUserProfile = async (details: { displayName?: string; phone?: string }) => {
    if (!user) return;
    const updated = {
      ...user,
      displayName: details.displayName ?? user.displayName,
      phone: details.phone ?? user.phone,
    };
    await handleSetUser(updated);
  };

  const signOut = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vf_demo_user');
    }
    if (clientAuth) {
      try {
        await fbSignOut(clientAuth);
      } catch (err) {
        console.warn('Signout warning:', err);
      }
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isConfigured,
        signInWithGoogle,
        signInWithDemo,
        signInWithEmail,
        updateUserProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
