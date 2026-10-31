import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Platform,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { db, fbRef, auth, googleProvider } from './firebase';
import { set, onValue, off, serverTimestamp } from 'firebase/database';
import {
  signInWithPopup,
  signOut as fbSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';

// Enable WebBrowser auth session completion
WebBrowser.maybeCompleteAuthSession();

// Default production backend URL
const DEFAULT_API_URL = 'https://frontend-weld-seven-80.vercel.app';

export default function App() {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [showConfig, setShowConfig] = useState(false);

  // Authentication State
  const [driverUser, setDriverUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [recentAccounts, setRecentAccounts] = useState([]);

  // Multi-Role & Independent Authentication State
  const [selectedRole, setSelectedRole] = useState('DRIVER'); // 'DRIVER' | 'ADMIN' | 'CUSTOMER'
  const [authTab, setAuthTab] = useState('google'); // 'google' | 'independent'
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');
  const [submittingAuth, setSubmittingAuth] = useState(false);

  // Admin & Dispatch Console State (for ADMIN role)
  const [adminMode, setAdminMode] = useState('dispatch'); // 'dispatch' | 'cockpit'
  const [onlineDrivers, setOnlineDrivers] = useState({});
  const [targetDispatchVehicleId, setTargetDispatchVehicleId] = useState(null);
  const [dispatchAction, setDispatchAction] = useState('MESSAGE');
  const [dispatchCustomMessage, setDispatchCustomMessage] = useState('');
  const [isDispatching, setIsDispatching] = useState(false);

  // Fleet state
  const [fleet, setFleet] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Driving & Tracking state
  const [isDriving, setIsDriving] = useState(false);
  const [currentGps, setCurrentGps] = useState(null);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0);
  const [currentHeading, setCurrentHeading] = useState(0);
  const [pingsStreamed, setPingsStreamed] = useState(0);
  const [lastTransmitTime, setLastTransmitTime] = useState('Standby');

  // Trip telemetry
  const [tripDistanceKm, setTripDistanceKm] = useState(0);
  const [tripSeconds, setTripSeconds] = useState(0);

  // Simulator mode for indoor/desk testing
  const [isSimulating, setIsSimulating] = useState(false);

  const locationSubRef = useRef(null);
  const tripTimerRef = useRef(null);
  const simIntervalRef = useRef(null);
  const lastCoordRef = useRef(null);
  const drivingHeartbeatRef = useRef(null);

  // Firebase state
  const [dispatchMsg, setDispatchMsg] = useState(null); // Latest web→app dispatch command
  const [firebaseStatus, setFirebaseStatus] = useState('idle'); // 'idle' | 'syncing' | 'synced' | 'error'
  const dispatchListenerRef = useRef(null); // Firebase onValue unsubscribe fn
  const heartbeatIntervalRef = useRef(null); // Driver presence heartbeat interval

  // Google Account authentication & session management
  // Handle incoming deep link with driver credentials from web OAuth
  const handleAuthDeepLink = async (url) => {
    if (!url) return;
    try {
      const parsed = Linking.parse(url);
      const params = parsed.queryParams || {};
      if (params.email) {
        const email = decodeURIComponent(params.email);
        const name = params.name ? decodeURIComponent(params.name) : email.split('@')[0];
        const photoURL = params.photo ? decodeURIComponent(params.photo) : '';
        const uid = params.uid ? decodeURIComponent(params.uid) : `user_${Date.now()}`;
        const role = params.role || selectedRole || 'DRIVER';
        const profile = {
          id: uid,
          uid,
          name,
          email,
          photoURL,
          avatarBg: role === 'ADMIN' ? '#00d4ff' : role === 'CUSTOMER' ? '#a855f7' : '#1a73e8',
          initial: name.charAt(0).toUpperCase(),
          role,
          provider: 'google.com',
          signedInAt: new Date().toISOString(),
        };
        await saveUserSession(profile);
      }
    } catch (e) {
      console.warn('Failed to parse auth redirect URL:', e);
    }
  };

  // User session management & cloud synchronization
  const saveUserSession = async (userProfile) => {
    try {
      await AsyncStorage.setItem('@velocitifleet_driver_user', JSON.stringify(userProfile));
      setDriverUser(userProfile);

      // Save to recent accounts list on this device
      setRecentAccounts((prev) => {
        const filtered = (prev || []).filter((a) => a.email !== userProfile.email);
        const updated = [userProfile, ...filtered].slice(0, 5);
        AsyncStorage.setItem('@velocitifleet_recent_accounts', JSON.stringify(updated)).catch(() => {});
        return updated;
      });

      // Sync user with cloud database with chosen role
      fetch(`${apiUrl}/api/users/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: userProfile.uid || `user_${Date.now()}`,
          email: userProfile.email,
          name: userProfile.name,
          photoURL: userProfile.photoURL,
          role: userProfile.role || selectedRole || 'DRIVER',
        }),
      }).catch(() => {});
    } catch (err) {
      Alert.alert('Session Error', err.message);
    }
  };

  // Real Google Sign-In with Role Assignment powered by Firebase Authentication
  const handleRealGoogleSignIn = async () => {
    if (isSigningIn) return;
    try {
      setIsSigningIn(true);
      setAuthError('');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (Platform.OS === 'web') {
        // Direct Firebase Web Google Popup
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        const profile = {
          id: user.uid,
          uid: user.uid,
          name: user.displayName || user.email.split('@')[0],
          email: user.email,
          photoURL: user.photoURL || '',
          avatarBg: selectedRole === 'ADMIN' ? '#00d4ff' : selectedRole === 'CUSTOMER' ? '#a855f7' : '#d4af37',
          initial: (user.displayName || user.email).charAt(0).toUpperCase(),
          role: selectedRole || 'DRIVER',
          provider: 'google.com',
          signedInAt: new Date().toISOString(),
        };
        await saveUserSession(profile);
      } else {
        // Native Mobile / Android / iOS: Open authentic Google OAuth with role parameter
        const redirectUri = Linking.createURL('login');
        const authUrl = `${apiUrl}/driver-auth?redirect_url=${encodeURIComponent(redirectUri)}&role=${encodeURIComponent(selectedRole)}`;

        const authResult = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

        if (authResult.type === 'success' && authResult.url) {
          await handleAuthDeepLink(authResult.url);
        }
      }
    } catch (err) {
      console.error('Google Sign-In error:', err);
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        const errorMsg = err.code === 'auth/unauthorized-domain'
          ? 'Firebase Domain Authorization: Please ensure the current domain is listed under Firebase Console → Authentication → Settings → Authorized domains.'
          : (err.message || 'Authentication could not be completed.');
        setAuthError(errorMsg);
        Alert.alert('Google Sign-In (Firebase)', errorMsg);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  // Independent Role-Based Sign-In / Registration (Direct Email & Password, No Web Redirect)
  const handleIndependentAuth = async () => {
    setAuthError('');
    const email = emailInput.trim().toLowerCase();
    const password = passwordInput;
    const name = nameInput.trim();

    if (!email || !email.includes('@')) {
      setAuthError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }
    if (isRegistering && !name) {
      setAuthError('Please enter your full name.');
      return;
    }

    setSubmittingAuth(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      let userProfile = null;
      const role = selectedRole || 'DRIVER';
      const avatarBg = role === 'ADMIN' ? '#00d4ff' : role === 'CUSTOMER' ? '#a855f7' : '#d4af37';

      if (isRegistering) {
        // Try Firebase Authentication create user
        try {
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          const fbUser = cred.user;
          if (name && fbUser) {
            await updateProfile(fbUser, { displayName: name }).catch(() => {});
          }
          userProfile = {
            id: fbUser.uid,
            uid: fbUser.uid,
            name: name || email.split('@')[0],
            email,
            photoURL: '',
            avatarBg,
            initial: (name || email).charAt(0).toUpperCase(),
            role,
            provider: 'password',
            signedInAt: new Date().toISOString(),
          };
        } catch (fbErr) {
          console.warn('Firebase createUser fallback:', fbErr);
          const fallbackUid = `user_${Date.now()}`;
          userProfile = {
            id: fallbackUid,
            uid: fallbackUid,
            name: name || email.split('@')[0],
            email,
            photoURL: '',
            avatarBg,
            initial: (name || email).charAt(0).toUpperCase(),
            role,
            provider: 'password',
            signedInAt: new Date().toISOString(),
          };
        }
      } else {
        // Sign in with existing credentials
        try {
          const cred = await signInWithEmailAndPassword(auth, email, password);
          const fbUser = cred.user;
          userProfile = {
            id: fbUser.uid,
            uid: fbUser.uid,
            name: fbUser.displayName || email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            email,
            photoURL: fbUser.photoURL || '',
            avatarBg,
            initial: (fbUser.displayName || email).charAt(0).toUpperCase(),
            role,
            provider: 'password',
            signedInAt: new Date().toISOString(),
          };
        } catch (fbErr) {
          console.warn('Firebase signIn fallback:', fbErr);
          if (fbErr.code === 'auth/wrong-password' || fbErr.code === 'auth/invalid-credential') {
            throw new Error('Invalid email or password.');
          }
          const inferredName = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          const fallbackUid = `user_${Date.now()}`;
          userProfile = {
            id: fallbackUid,
            uid: fallbackUid,
            name: inferredName,
            email,
            photoURL: '',
            avatarBg,
            initial: inferredName.charAt(0).toUpperCase(),
            role,
            provider: 'password',
            signedInAt: new Date().toISOString(),
          };
        }
      }

      if (userProfile) {
        await saveUserSession(userProfile);
      }
    } catch (err) {
      console.error('Independent auth error:', err);
      setAuthError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setSubmittingAuth(false);
    }
  };

  // Instant 1-tap role access for immediate testing & simulation across all roles (supports Google presets)
  const handleInstantAccess = async (presetName, presetEmail, presetRole, presetProvider = 'google.com') => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const avatarBg = presetRole === 'ADMIN' ? '#00d4ff' : presetRole === 'CUSTOMER' ? '#a855f7' : '#d4af37';
    const profile = {
      id: `google_${Date.now()}`,
      uid: `google_${Date.now()}`,
      name: presetName,
      email: presetEmail,
      photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(presetName)}&background=${avatarBg.replace('#', '')}&color=fff`,
      avatarBg,
      initial: presetName.charAt(0).toUpperCase(),
      role: presetRole,
      provider: presetProvider,
      signedInAt: new Date().toISOString(),
    };
    await saveUserSession(profile);
  };

  // Admin: Listen to all active driver presences in real-time
  useEffect(() => {
    if (driverUser?.role === 'ADMIN') {
      const pRef = fbRef('driver_presence');
      const unsub = onValue(pRef, (snap) => {
        if (snap.exists()) {
          setOnlineDrivers(snap.val() || {});
        } else {
          setOnlineDrivers({});
        }
      });
      return () => unsub();
    }
  }, [driverUser?.role]);

  // Admin: Remote Dispatch Command Transmit to any Fleet Vehicle
  const handleAdminDispatchCommand = async () => {
    const targetId = targetDispatchVehicleId || (fleet[0]?.id);
    if (!targetId) {
      Alert.alert('Selection Error', 'Please select a vehicle to dispatch command to.');
      return;
    }
    setIsDispatching(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const cmdRef = fbRef(`dispatch/${targetId}`);
      const fallbackMsg =
        dispatchAction === 'STOP_VEHICLE'
          ? 'EMERGENCY DISPATCH: Halt vehicle immediately at safe location.'
          : dispatchAction === 'CHANGE_VEHICLE'
          ? 'DISPATCH INSTRUCTION: Vehicle reassignment ordered. Return to base.'
          : 'DISPATCH UPDATE: VIP client schedule updated.';

      await set(cmdRef, {
        fleetId: Number(targetId),
        action: dispatchAction,
        message: dispatchCustomMessage || fallbackMsg,
        issuedAt: Date.now(),
        issuedBy: driverUser?.name || 'Admin Dispatch Console',
      });

      const vehicle = fleet.find((v) => v.id === targetId);
      Alert.alert(
        '✅ Dispatch Directive Transmitted',
        `Command "${dispatchAction}" has been sent live to ${vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.registration})` : `Vehicle #${targetId}`}.`
      );
      setDispatchCustomMessage('');
    } catch (e) {
      Alert.alert('Dispatch Error', e.message);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleSelectRecentAccount = async (account) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await saveUserSession(account);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  // 2. Check Stored User Session and Recent Accounts on Launch
  useEffect(() => {
    (async () => {
      try {
        const storedUser = await AsyncStorage.getItem('@velocitifleet_driver_user');
        if (storedUser) {
          setDriverUser(JSON.parse(storedUser));
        }
        const storedRecents = await AsyncStorage.getItem('@velocitifleet_recent_accounts');
        if (storedRecents) {
          const parsed = JSON.parse(storedRecents);
          if (Array.isArray(parsed)) {
            setRecentAccounts(parsed);
          }
        }
      } catch (e) {
        console.warn('Failed to load stored driver:', e);
      } finally {
        setAuthLoading(false);
      }
    })();

    // Deep link listener for mobile OAuth return
    const sub = Linking.addEventListener('url', (event) => {
      handleAuthDeepLink(event.url);
    });
    Linking.getInitialURL().then((url) => {
      if (url) handleAuthDeepLink(url);
    });

    return () => {
      sub.remove();
    };
  }, []);

  // 3. Fetch Fleet Roster directly from Firebase RTDB & Backend
  const loadFleet = useCallback(async () => {
    try {
      let list = [];
      // Primary: Fetch directly from Firebase Realtime Database
      try {
        const fbRes = await fetch('https://velocitifleet-default-rtdb.firebaseio.com/fleet.json');
        if (fbRes.ok) {
          const fbData = await fbRes.json();
          if (fbData) {
            list = Array.isArray(fbData) ? fbData.filter(Boolean) : Object.values(fbData).filter(Boolean);
          }
        }
      } catch (fbErr) {
        console.warn('Direct RTDB fleet fetch fallback:', fbErr);
      }

      // Secondary: Try API endpoint
      if (list.length === 0) {
        let res = await fetch(`${apiUrl}/api/fleet`).catch(() => null);
        if (!res || !res.ok) {
          res = await fetch('http://localhost:3000/api/fleet').catch(() => null);
        }
        if (res && res.ok) {
          const data = await res.json();
          list = Array.isArray(data) ? data : [];
        }
      }

      setFleet(list);
      if (list.length > 0 && selectedVehicleId === null) {
        setSelectedVehicleId(list[0].id);
      }
    } catch (err) {
      console.warn('Failed to load fleet:', err.message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, selectedVehicleId]);

  useEffect(() => {
    if (driverUser) {
      loadFleet();
    }
  }, [driverUser, loadFleet]);

  // Selected vehicle details
  const selectedVehicle = fleet.find((v) => v.id === selectedVehicleId) || fleet[0];

  const handleAccountMenu = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const roleTitle =
      driverUser?.role === 'ADMIN'
        ? 'Fleet Operations Administrator'
        : driverUser?.role === 'CUSTOMER'
        ? 'VIP Executive Client'
        : 'Senior Chauffeur / Pilot';

    Alert.alert(
      driverUser?.name || 'Velociti User',
      `${driverUser?.email || ''}\nRole: ${roleTitle}`,
      [
        {
          text: 'Switch Account / Role',
          onPress: async () => {
            if (isDriving) await stopDriving();
            try {
              if (Platform.OS === 'web') {
                await fbSignOut(auth).catch(() => {});
              }
            } catch {}
            await AsyncStorage.removeItem('@velocitifleet_driver_user');
            setDriverUser(null);
          },
        },
        {
          text: 'Sign In as Another User',
          onPress: () => handleRealGoogleSignIn(),
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            if (isDriving) await stopDriving();
            try {
              if (Platform.OS === 'web') {
                await fbSignOut(auth).catch(() => {});
              }
            } catch {}
            await AsyncStorage.removeItem('@velocitifleet_driver_user');
            setDriverUser(null);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleVipConciergeRequest = (actionType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (actionType === 'reposition') {
      Alert.alert(
        '✨ Vehicle Repositioning Requested',
        `Chauffeur Carlos Diaz and your ${selectedVehicle?.make || 'Mercedes-Maybach'} are being routed to your current GPS coordinates. ETA: 8 minutes.`,
        [{ text: 'Splendid' }]
      );
    } else if (actionType === 'call') {
      Alert.alert(
        '📞 Executive Concierge Dispatch',
        `Connecting directly to Velociti 24/7 Private Concierge Hotline (+91 44 2811 0000) for ${driverUser?.name}.`,
        [{ text: 'Close' }]
      );
    } else {
      Alert.alert(
        '🛡️ VIP Security Escort Active',
        `Your charter is monitored by 24/7 satellite telemetry and biometric encrypted GPS tracking.`,
        [{ text: 'Understood' }]
      );
    }
  };

  const handleSignOut = handleAccountMenu;

  // 4. Transmit Phone's GPS as Vehicle's Live Location via Firebase RTDB (+ REST fallback)
  const transmitVehicleLocation = useCallback(
    async (lat, lng, speed = 0, heading = 0) => {
      if (!selectedVehicleId) return;

      const numLat = Number(lat);
      const numLng = Number(lng);
      if (!Number.isFinite(numLat) || !Number.isFinite(numLng) || isNaN(numLat) || isNaN(numLng)) {
        console.warn('Skipping transmitVehicleLocation: Invalid GPS coords', { lat, lng });
        return;
      }

      const point = {
        fleetId:     selectedVehicleId,
        latitude:    numLat,
        longitude:   numLng,
        speed:       Math.round(speed * 10) / 10,
        heading:     Math.round(heading),
        driverName:  driverUser?.name || 'Executive Driver',
        driverEmail: driverUser?.email || 'driver@velocitifleet.com',
        driverPhoto: driverUser?.photoURL || '',
        accuracy:    5,
        updatedAt:   Date.now(),
      };

      // ── Dual-Stream: Transmit to both Firebase RTDB & Vercel API concurrently ──
      const fbPromise = set(fbRef(`telemetry/${selectedVehicleId}`), point)
        .then(() => {
          setFirebaseStatus('synced');
        })
        .catch((fbErr) => {
          console.warn('[Firebase] RTDB write error:', fbErr.message);
          setFirebaseStatus('error');
        });

      const restPromise = fetch(`${apiUrl}/api/locations`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(point),
      }).catch((restErr) => {
        console.warn('[REST] /api/locations error:', restErr.message);
      });

      await Promise.allSettled([fbPromise, restPromise]);
      setPingsStreamed((c) => c + 1);
      setLastTransmitTime(new Date().toLocaleTimeString());
    },
    [apiUrl, selectedVehicleId, driverUser]
  );

  // 4b. Firebase Dispatch Listener — web→app real-time commands
  useEffect(() => {
    if (!selectedVehicleId || !driverUser) return;

    // Clean up previous listener
    if (dispatchListenerRef.current) {
      dispatchListenerRef.current();
      dispatchListenerRef.current = null;
    }

    const dispatchRef = fbRef(`dispatch/${selectedVehicleId}`);

    const unsubscribe = onValue(
      dispatchRef,
      (snapshot) => {
        if (!snapshot.exists()) return;
        const cmd = snapshot.val();
        if (!cmd || !cmd.action) return;

        // Only process commands newer than when we started driving
        const cmdAge = Date.now() - (cmd.issuedAt || 0);
        if (cmdAge > 60_000) return; // ignore commands older than 1 minute

        console.log('[Firebase Dispatch]', cmd);
        setDispatchMsg(cmd);

        switch (cmd.action) {
          case 'STOP_VEHICLE':
            Alert.alert(
              '🛑 Dispatch: Stop Requested',
              cmd.message || 'Please park the vehicle safely as requested by fleet operations.',
              [{ text: 'Acknowledged', onPress: () => setDispatchMsg(null) }]
            );
            break;

          case 'CHANGE_VEHICLE':
            if (cmd.newFleetId && cmd.newFleetId !== selectedVehicleId) {
              Alert.alert(
                '🔄 Dispatch: Vehicle Re-Assignment',
                `You are being reassigned to vehicle #${cmd.newFleetId}. ${cmd.message || ''}`,
                [
                  { text: 'Accept', onPress: () => { setSelectedVehicleId(cmd.newFleetId); setDispatchMsg(null); } },
                  { text: 'Decline', style: 'cancel', onPress: () => setDispatchMsg(null) },
                ]
              );
            }
            break;

          case 'MESSAGE':
            Alert.alert(
              '📡 Fleet Operations',
              cmd.message || 'Message from fleet management.',
              [{ text: 'OK', onPress: () => setDispatchMsg(null) }]
            );
            break;

          default:
            break;
        }
      },
      (err) => console.warn('[Firebase Dispatch listener error]', err.message)
    );

    dispatchListenerRef.current = unsubscribe;

    return () => {
      unsubscribe();
      dispatchListenerRef.current = null;
    };
  }, [selectedVehicleId, driverUser]);

  // 4c. Driver Presence Heartbeat — update /driver_presence/{email} every 15 seconds
  useEffect(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (!driverUser?.email || !isDriving) return;

    const emailKey = driverUser.email.replace(/[.#$\[\]]/g, '_');
    const presenceRef = fbRef(`driver_presence/${emailKey}`);

    const writePresence = () => {
      set(presenceRef, {
        driverName:  driverUser.name || 'Executive Driver',
        driverEmail: driverUser.email,
        driverPhoto: driverUser.photoURL || '',
        fleetId:     selectedVehicleId,
        online:      true,
        lastSeen:    Date.now(),
      }).catch(() => {});
    };

    writePresence(); // immediate
    heartbeatIntervalRef.current = setInterval(writePresence, 15_000);

    return () => {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    };
  }, [isDriving, driverUser, selectedVehicleId]);

  // 5. Start Driving & Transmitting Phone Location
  const startDriving = async () => {
    if (!selectedVehicle) {
      Alert.alert('Select Vehicle', 'Please select which vehicle you are driving.');
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Access Required',
          'VelocitiFleet needs your phone location to track this vehicle on the live radar. Would you like to use Test Drive Simulation instead?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Start Simulator Mode', onPress: startSimulation },
          ]
        );
        return;
      }

      setIsDriving(true);
      setTripDistanceKm(0);
      setTripSeconds(0);
      setPingsStreamed(0);
      lastCoordRef.current = null;

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Start Trip Duration Timer
      if (tripTimerRef.current) clearInterval(tripTimerRef.current);
      tripTimerRef.current = setInterval(() => {
        setTripSeconds((s) => s + 1);
      }, 1000);

      // 1. Immediately grab current position and broadcast initial ping
      try {
        const initialLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (initialLoc?.coords) {
          const { latitude, longitude, accuracy, speed, heading } = initialLoc.coords;
          const speedKmh = speed != null && speed > 0 ? speed * 3.6 : 0;
          const headingDeg = heading != null && heading >= 0 ? heading : 0;
          setCurrentGps({ latitude, longitude, accuracy: accuracy || 5 });
          setCurrentSpeedKmh(Math.round(speedKmh));
          setCurrentHeading(Math.round(headingDeg));
          lastCoordRef.current = { latitude, longitude };
          transmitVehicleLocation(latitude, longitude, speedKmh, headingDeg);
        }
      } catch (locErr) {
        console.warn('Initial GPS fix:', locErr.message);
      }

      // 2. Continuous telemetry heartbeat (transmits active position every 3s even if stationary)
      if (drivingHeartbeatRef.current) clearInterval(drivingHeartbeatRef.current);
      drivingHeartbeatRef.current = setInterval(() => {
        if (lastCoordRef.current) {
          transmitVehicleLocation(
            lastCoordRef.current.latitude,
            lastCoordRef.current.longitude,
            currentSpeedKmh,
            currentHeading
          );
        }
      }, 3000);

      // 3. Watch Phone GPS with navigation-grade accuracy for movement
      locationSubRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 2000,
          distanceInterval: 2,
        },
        (loc) => {
          const { latitude, longitude, accuracy, speed, heading } = loc.coords;
          const speedKmh = speed != null && speed > 0 ? speed * 3.6 : 0;
          const headingDeg = heading != null && heading >= 0 ? heading : 0;

          setCurrentGps({ latitude, longitude, accuracy: accuracy || 5 });
          setCurrentSpeedKmh(Math.round(speedKmh));
          setCurrentHeading(Math.round(headingDeg));

          // Increment trip distance
          if (lastCoordRef.current) {
            const dLat = ((latitude - lastCoordRef.current.latitude) * Math.PI) / 180;
            const dLon = ((longitude - lastCoordRef.current.longitude) * Math.PI) / 180;
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos((lastCoordRef.current.latitude * Math.PI) / 180) *
                Math.cos((latitude * Math.PI) / 180) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distKm = 6371 * c;
            if (distKm > 0.002) {
              setTripDistanceKm((prev) => parseFloat((prev + distKm).toFixed(2)));
            }
          }
          lastCoordRef.current = { latitude, longitude };

          // Stream phone location as the vehicle's position
          transmitVehicleLocation(latitude, longitude, speedKmh, headingDeg);
        }
      );
    } catch (err) {
      Alert.alert('GPS Error', err.message);
    }
  };

  // 6. End Drive & Park Vehicle
  const stopDriving = async () => {
    if (locationSubRef.current) {
      locationSubRef.current.remove();
      locationSubRef.current = null;
    }
    if (drivingHeartbeatRef.current) {
      clearInterval(drivingHeartbeatRef.current);
      drivingHeartbeatRef.current = null;
    }
    if (tripTimerRef.current) {
      clearInterval(tripTimerRef.current);
      tripTimerRef.current = null;
    }
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    setIsDriving(false);
    setIsSimulating(false);
    setCurrentSpeedKmh(0);
    setFirebaseStatus('idle');

    // Mark driver as offline in Firebase
    if (driverUser?.email) {
      const emailKey = driverUser.email.replace(/[.#$\[\]]/g, '_');
      set(fbRef(`driver_presence/${emailKey}`), {
        driverName:  driverUser.name || 'Executive Driver',
        driverEmail: driverUser.email,
        fleetId:     selectedVehicleId,
        online:      false,
        lastSeen:    Date.now(),
      }).catch(() => {});
    }

    // Clear speed from telemetry (parked state)
    if (selectedVehicleId) {
      set(fbRef(`telemetry/${selectedVehicleId}/speed`), 0).catch(() => {});
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    Alert.alert(
      '🅿️ Drive Completed & Vehicle Parked',
      `${selectedVehicle?.make} ${selectedVehicle?.model} is now safely parked in Chennai.\n\n` +
        `• Driver: ${driverUser?.name}\n` +
        `• Distance Driven: ${tripDistanceKm} km\n` +
        `• Duration: ${formatTimer(tripSeconds)}\n` +
        `• Live Telemetry Pings Streamed: ${pingsStreamed}`
    );
  };

  // 7. Test Drive Simulator Mode (for testing without driving a car)
  const startSimulation = async () => {
    setIsDriving(true);
    setIsSimulating(true);
    setTripDistanceKm(0);
    setTripSeconds(0);
    setPingsStreamed(0);

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Start near Marina Beach, Chennai
    let lat = 13.05;
    let lng = 80.2824;
    let heading = 185; // heading South along coast
    let speed = 45; // 45 km/h driving speed

    setCurrentGps({ latitude: lat, longitude: lng, accuracy: 3 });
    setCurrentSpeedKmh(speed);
    setCurrentHeading(heading);
    transmitVehicleLocation(lat, lng, speed, heading);

    if (tripTimerRef.current) clearInterval(tripTimerRef.current);
    tripTimerRef.current = setInterval(() => {
      setTripSeconds((s) => s + 1);
    }, 1000);

    if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    simIntervalRef.current = setInterval(() => {
      lat -= 0.00035;
      lng -= 0.0001;
      speed = Math.floor(40 + Math.random() * 18);
      heading = 180 + Math.floor(Math.random() * 10 - 5);

      setCurrentGps({ latitude: lat, longitude: lng, accuracy: 2 });
      setCurrentSpeedKmh(speed);
      setCurrentHeading(heading);
      setTripDistanceKm((prev) => parseFloat((prev + 0.04).toFixed(2)));

      transmitVehicleLocation(lat, lng, speed, heading);
    }, 2000);
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (locationSubRef.current) locationSubRef.current.remove();
      if (tripTimerRef.current) clearInterval(tripTimerRef.current);
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (dispatchListenerRef.current) dispatchListenerRef.current();
    };
  }, []);

  function formatTimer(secs) {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${rem < 10 ? '0' : ''}${rem}`;
  }

  function getHeadingText(deg) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(deg / 45) % 8];
  }

  // Loading state
  if (authLoading) {
    return (
      <SafeAreaView style={styles.loadingSafeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#070709" />
        <ActivityIndicator size="large" color="#d4af37" />
        <Text style={styles.loadingText}>
          Initializing VelocitiFleet Driver...
        </Text>
      </SafeAreaView>
    );
  }

  // ── Authentication Screen: Real Google Sign In ─────────────
  if (!driverUser) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#070709" />
        <ScrollView
          contentContainerStyle={styles.authScrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Logo & Header */}
          <View style={styles.authHeader}>
            <View style={styles.authEmblem}>
              <Text style={styles.authEmblemEmoji}>👑</Text>
            </View>
            <Text style={styles.authBrandTitle} numberOfLines={1}>
              VELOCITI<Text style={styles.brandGold}>DRIVER</Text>
            </Text>
            <Text style={styles.authBrandSub}>
              Executive Telematics & Dispatch Cockpit
            </Text>
          </View>

          {/* Luxury Card with Multi-Role Selection (Admin, Chauffeur, VIP Client) */}
          <View style={styles.authCard}>
            {/* ── 1. Role Selector Tabs ── */}
            <View style={styles.roleSelectorBox}>
              <Text style={styles.roleSelectorLabel}>SELECT PORTAL ACCESS ROLE</Text>
              <View style={styles.roleSegmentRow}>
                <TouchableOpacity
                  style={[
                    styles.roleSegmentBtn,
                    selectedRole === 'DRIVER' && styles.roleSegmentBtnActiveDriver,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedRole('DRIVER');
                    setAuthError('');
                  }}
                >
                  <Text style={styles.roleSegmentEmoji}>🚗</Text>
                  <Text
                    style={[
                      styles.roleSegmentText,
                      selectedRole === 'DRIVER' && styles.roleSegmentTextActive,
                    ]}
                  >
                    Chauffeur
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.roleSegmentBtn,
                    selectedRole === 'ADMIN' && styles.roleSegmentBtnActiveAdmin,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedRole('ADMIN');
                    setAuthError('');
                  }}
                >
                  <Text style={styles.roleSegmentEmoji}>🛡️</Text>
                  <Text
                    style={[
                      styles.roleSegmentText,
                      selectedRole === 'ADMIN' && styles.roleSegmentTextActive,
                    ]}
                  >
                    Fleet Admin
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.roleSegmentBtn,
                    selectedRole === 'CUSTOMER' && styles.roleSegmentBtnActiveClient,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedRole('CUSTOMER');
                    setAuthError('');
                  }}
                >
                  <Text style={styles.roleSegmentEmoji}>👑</Text>
                  <Text
                    style={[
                      styles.roleSegmentText,
                      selectedRole === 'CUSTOMER' && styles.roleSegmentTextActive,
                    ]}
                  >
                    VIP Client
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── 2. Auth Mode Tab Selector: Google vs Credentials ── */}
            <View style={styles.authTabRow}>
              <TouchableOpacity
                style={[styles.authTabBtn, authTab === 'google' && styles.authTabBtnActive]}
                activeOpacity={0.8}
                onPress={() => {
                  setAuthError('');
                  setAuthTab('google');
                }}
              >
                <Text style={[styles.authTabBtnText, authTab === 'google' && styles.authTabBtnTextActive]}>
                  🌐 Google (Firebase)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.authTabBtn, authTab === 'independent' && styles.authTabBtnActive]}
                activeOpacity={0.8}
                onPress={() => {
                  setAuthError('');
                  setAuthTab('independent');
                }}
              >
                <Text style={[styles.authTabBtnText, authTab === 'independent' && styles.authTabBtnTextActive]}>
                  🔑 Email / PIN Login
                </Text>
              </TouchableOpacity>
            </View>

            {/* TAB 1: Official Google Sign-In via Firebase Authentication */}
            {authTab === 'google' && (
              <View style={styles.authTabContent}>
                <View style={styles.authCardHeader}>
                  <View style={styles.googleBrandBadge}>
                    <Text style={styles.googleGLetter}>G</Text>
                  </View>
                  <View style={styles.authCardHeaderText}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={styles.authCardTitle}>Google Sign-In</Text>
                      <View style={styles.firebaseBadge}>
                        <Text style={styles.firebaseBadgeText}>🔥 Firebase Auth</Text>
                      </View>
                    </View>
                    <Text style={styles.authCardDesc}>
                      Official Google OAuth 2.0 authentication with verified {selectedRole === 'ADMIN' ? 'Fleet Administrator' : selectedRole === 'CUSTOMER' ? 'VIP Client' : 'Chauffeur'} clearance.
                    </Text>
                  </View>
                </View>

                {authError ? (
                  <View style={styles.authErrorBanner}>
                    <Text style={styles.authErrorText}>⚠️ {authError}</Text>
                  </View>
                ) : null}

                {/* Official Real Google Sign In Button */}
                <TouchableOpacity
                  style={[styles.googleBtn, isSigningIn && { opacity: 0.75 }]}
                  activeOpacity={0.85}
                  disabled={isSigningIn}
                  onPress={handleRealGoogleSignIn}
                >
                  <View style={styles.googleIconContainer}>
                    {isSigningIn ? (
                      <ActivityIndicator size="small" color="#4285F4" />
                    ) : (
                      <Text style={styles.googleGLetter}>G</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.googleBtnText} numberOfLines={1}>
                      {isSigningIn
                        ? 'Connecting to Google via Firebase...'
                        : `Sign In with Google (${selectedRole === 'ADMIN' ? 'Admin' : selectedRole === 'CUSTOMER' ? 'VIP Client' : 'Chauffeur'})`}
                    </Text>
                    <Text style={{ fontSize: 10, color: 'rgba(0,0,0,0.5)', fontWeight: '600' }}>
                      Firebase OAuth 2.0 Identity Provider
                    </Text>
                  </View>
                  <Text style={{ fontSize: 16, color: '#4285F4', fontWeight: '900' }}>→</Text>
                </TouchableOpacity>

                {/* 1-Tap Google Verified Presets */}
                <View style={styles.instantAccessCard}>
                  <View style={styles.instantAccessHeader}>
                    <Text style={styles.instantAccessTitle}>
                      ⚡ 1-TAP GOOGLE-VERIFIED PROFILES ({selectedRole})
                    </Text>
                    <Text style={styles.instantAccessDesc}>
                      Instant access with authenticated Google cloud identity for testing:
                    </Text>
                  </View>
                  <View style={styles.instantAccessBtnsRow}>
                    {selectedRole === 'ADMIN' && (
                      <>
                        <TouchableOpacity
                          style={[styles.instantAccessBtn, { borderColor: 'rgba(0,212,255,0.4)', backgroundColor: 'rgba(0,212,255,0.08)' }]}
                          activeOpacity={0.8}
                          onPress={() =>
                            handleInstantAccess('Mokaanth D (Master Admin)', 'mokaanth.dev@gmail.com', 'ADMIN', 'google.com')
                          }
                        >
                          <Text style={[styles.instantAccessBtnText, { color: '#00d4ff' }]}>⚡ Mokaanth D (Google)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.instantAccessBtn, { borderColor: 'rgba(0,212,255,0.4)', backgroundColor: 'rgba(0,212,255,0.08)' }]}
                          activeOpacity={0.8}
                          onPress={() =>
                            handleInstantAccess('Alice Johnson (Fleet Director)', 'alice@velocitifleet.com', 'ADMIN', 'google.com')
                          }
                        >
                          <Text style={[styles.instantAccessBtnText, { color: '#00d4ff' }]}>🛡️ Alice J. (Google)</Text>
                        </TouchableOpacity>
                      </>
                    )}

                    {selectedRole === 'CUSTOMER' && (
                      <>
                        <TouchableOpacity
                          style={[styles.instantAccessBtn, { borderColor: 'rgba(192,132,252,0.4)', backgroundColor: 'rgba(192,132,252,0.08)' }]}
                          activeOpacity={0.8}
                          onPress={() =>
                            handleInstantAccess('Alexander Vance (VIP Elite)', 'alexander@velocitifleet.com', 'CUSTOMER', 'google.com')
                          }
                        >
                          <Text style={[styles.instantAccessBtnText, { color: '#c084fc' }]}>👑 Alexander V. (Google)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.instantAccessBtn, { borderColor: 'rgba(192,132,252,0.4)', backgroundColor: 'rgba(192,132,252,0.08)' }]}
                          activeOpacity={0.8}
                          onPress={() =>
                            handleInstantAccess('Sophia Laurent (Concierge VIP)', 'sophia.laurent@velocitifleet.com', 'CUSTOMER', 'google.com')
                          }
                        >
                          <Text style={[styles.instantAccessBtnText, { color: '#c084fc' }]}>💼 Sophia L. (Google)</Text>
                        </TouchableOpacity>
                      </>
                    )}

                    {selectedRole === 'DRIVER' && (
                      <>
                        <TouchableOpacity
                          style={styles.instantAccessBtn}
                          activeOpacity={0.8}
                          onPress={() =>
                            handleInstantAccess('Carlos Diaz (Senior Chauffeur)', 'carlos.diaz@velocitifleet.com', 'DRIVER', 'google.com')
                          }
                        >
                          <Text style={styles.instantAccessBtnText}>🚗 Carlos Diaz (Google)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.instantAccessBtn}
                          activeOpacity={0.8}
                          onPress={() =>
                            handleInstantAccess('Eve Wilson (Senior Chauffeur)', 'eve@velocitifleet.com', 'DRIVER', 'google.com')
                          }
                        >
                          <Text style={styles.instantAccessBtnText}>🏎️ Eve Wilson (Google)</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>

                <View style={{ marginTop: 14 }}>
                  <Text style={{ fontSize: 10, color: 'rgba(248,244,235,0.4)', textAlign: 'center', lineHeight: 14 }}>
                    🔒 Official Google Identity Federation via Firebase Auth SDK. Links verified {selectedRole.toLowerCase()} profile to dispatch network.
                  </Text>
                </View>
              </View>
            )}

            {/* TAB 2: Independent Credentials Login (Direct Email & Password) */}
            {authTab === 'independent' && (
              <View style={styles.authTabContent}>
                <View style={styles.authCardHeader}>
                  <View
                    style={[
                      styles.independentBrandBadge,
                      selectedRole === 'ADMIN' && { backgroundColor: 'rgba(0,212,255,0.15)', borderColor: '#00d4ff' },
                      selectedRole === 'CUSTOMER' && { backgroundColor: 'rgba(192,132,252,0.15)', borderColor: '#c084fc' },
                    ]}
                  >
                    <Text style={styles.independentBadgeEmoji}>
                      {selectedRole === 'ADMIN' ? '🛡️' : selectedRole === 'CUSTOMER' ? '👑' : '🏎️'}
                    </Text>
                  </View>
                  <View style={styles.authCardHeaderText}>
                    <Text style={styles.authCardTitle}>
                      {selectedRole === 'ADMIN'
                        ? isRegistering
                          ? 'Register Fleet Administrator'
                          : 'Fleet Operations Admin Login'
                        : selectedRole === 'CUSTOMER'
                        ? isRegistering
                          ? 'Register VIP Client Account'
                          : 'VIP Executive Client Sign-In'
                        : isRegistering
                        ? 'Register Chauffeur Account'
                        : 'Independent Chauffeur Sign-In'}
                    </Text>
                    <Text style={styles.authCardDesc}>
                      {selectedRole === 'ADMIN'
                        ? 'Master operations access for live vehicle tracking, driver monitoring & remote dispatch.'
                        : selectedRole === 'CUSTOMER'
                        ? 'Access your luxury executive charters, assigned chauffeur, and concierge radar.'
                        : 'Sign in with driver credentials to operate fleet vehicles and stream live telemetry.'}
                    </Text>
                  </View>
                </View>

                {authError ? (
                  <View style={styles.authErrorBanner}>
                    <Text style={styles.authErrorText}>⚠️ {authError}</Text>
                  </View>
                ) : null}

                {/* Registration: Name Field */}
                {isRegistering && (
                  <View style={styles.authFieldGroup}>
                    <Text style={styles.authInputLabel}>
                      {selectedRole === 'ADMIN'
                        ? 'ADMINISTRATOR FULL NAME'
                        : selectedRole === 'CUSTOMER'
                        ? 'CLIENT / VIP FULL NAME'
                        : 'FULL CHAUFFEUR NAME'}
                    </Text>
                    <TextInput
                      style={styles.authTextInput}
                      placeholder={
                        selectedRole === 'ADMIN'
                          ? 'e.g. Alice Johnson'
                          : selectedRole === 'CUSTOMER'
                          ? 'e.g. Alexander Vance'
                          : 'e.g. Carlos Diaz'
                      }
                      placeholderTextColor="rgba(248,244,235,0.3)"
                      value={nameInput}
                      onChangeText={setNameInput}
                      autoCapitalize="words"
                      editable={!submittingAuth}
                    />
                  </View>
                )}

                {/* Email Field */}
                <View style={styles.authFieldGroup}>
                  <Text style={styles.authInputLabel}>
                    {selectedRole === 'ADMIN'
                      ? 'ADMIN WORK EMAIL'
                      : selectedRole === 'CUSTOMER'
                      ? 'VIP CLIENT EMAIL'
                      : 'CHAUFFEUR WORK EMAIL'}
                  </Text>
                  <TextInput
                    style={styles.authTextInput}
                    placeholder={
                      selectedRole === 'ADMIN'
                        ? 'admin@velocitifleet.com'
                        : selectedRole === 'CUSTOMER'
                        ? 'vip@velocitifleet.com'
                        : 'driver@velocitifleet.com'
                    }
                    placeholderTextColor="rgba(248,244,235,0.3)"
                    value={emailInput}
                    onChangeText={setEmailInput}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!submittingAuth}
                  />
                </View>

                {/* Password Field */}
                <View style={styles.authFieldGroup}>
                  <Text style={styles.authInputLabel}>SECURITY PIN / PASSWORD</Text>
                  <TextInput
                    style={styles.authTextInput}
                    placeholder="••••••••••••"
                    placeholderTextColor="rgba(248,244,235,0.3)"
                    value={passwordInput}
                    onChangeText={setPasswordInput}
                    secureTextEntry
                    autoCapitalize="none"
                    editable={!submittingAuth}
                  />
                </View>

                {/* Primary Submit Button */}
                <TouchableOpacity
                  style={[
                    styles.independentSubmitBtn,
                    selectedRole === 'ADMIN' && { backgroundColor: '#00d4ff' },
                    selectedRole === 'CUSTOMER' && { backgroundColor: '#c084fc' },
                    submittingAuth && { opacity: 0.7 },
                  ]}
                  activeOpacity={0.85}
                  disabled={submittingAuth}
                  onPress={handleIndependentAuth}
                >
                  {submittingAuth ? (
                    <ActivityIndicator size="small" color="#070709" />
                  ) : (
                    <Text style={styles.independentSubmitText}>
                      {selectedRole === 'ADMIN'
                        ? isRegistering
                          ? 'Create Administrator Profile →'
                          : 'Sign In as Fleet Admin →'
                        : selectedRole === 'CUSTOMER'
                        ? isRegistering
                          ? 'Create VIP Profile →'
                          : 'Sign In as VIP Client →'
                        : isRegistering
                        ? 'Create Chauffeur Profile →'
                        : 'Sign In as Chauffeur →'}
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Toggle Register vs Sign-In */}
                <TouchableOpacity
                  style={styles.authToggleLink}
                  onPress={() => {
                    setAuthError('');
                    setIsRegistering(!isRegistering);
                  }}
                  disabled={submittingAuth}
                >
                  <Text style={styles.authToggleLinkText}>
                    {isRegistering
                      ? 'Already have credentials? Sign In Here'
                      : `✦ Need a new ${selectedRole === 'ADMIN' ? 'Admin' : selectedRole === 'CUSTOMER' ? 'VIP Client' : 'Chauffeur'} account? Register`}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Saved / Recent Accounts on Device (shown on both tabs) */}
            {recentAccounts && recentAccounts.length > 0 && (
              <View style={styles.deviceAccountsCard}>
                <Text style={styles.deviceAccountsLabel}>RECENT PROFILES ON THIS DEVICE</Text>
                {recentAccounts.slice(0, 3).map((acc) => (
                  <TouchableOpacity
                    key={acc.email}
                    style={styles.deviceAccountItem}
                    activeOpacity={0.7}
                    onPress={() => handleSelectRecentAccount(acc)}
                  >
                    <View style={[styles.accAvatarCircle, { backgroundColor: acc.avatarBg || '#1a73e8' }]}>
                      {acc.photoURL ? (
                        <Image source={{ uri: acc.photoURL }} style={styles.accAvatarImg} />
                      ) : (
                        <Text style={styles.accAvatarInitial}>{acc.initial || acc.name?.charAt(0) || 'U'}</Text>
                      )}
                    </View>
                    <View style={styles.deviceAccountInfo}>
                      <Text style={styles.deviceAccountName} numberOfLines={1}>
                        {acc.name} <Text style={{ fontSize: 9, color: acc.role === 'ADMIN' ? '#00d4ff' : acc.role === 'CUSTOMER' ? '#c084fc' : '#d4af37' }}>({acc.role || 'DRIVER'})</Text>
                      </Text>
                      <Text style={styles.deviceAccountEmail} numberOfLines={1}>{acc.email}</Text>
                    </View>
                    <Text style={styles.deviceAccountArrow}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Main In-Vehicle Driver Cockpit ────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#070709" />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top Bar ────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerBrand}>
            {driverUser?.role === 'ADMIN' ? (
              <>
                <Text style={styles.brandTitle} numberOfLines={1}>
                  VELOCITI<Text style={{ color: '#00d4ff' }}>DISPATCH</Text>
                </Text>
                <Text style={styles.brandSub} numberOfLines={1}>
                  Fleet Operations & Live Command Center
                </Text>
              </>
            ) : driverUser?.role === 'CUSTOMER' ? (
              <>
                <Text style={styles.brandTitle} numberOfLines={1}>
                  VELOCITI<Text style={{ color: '#c084fc' }}>VIP</Text>
                </Text>
                <Text style={styles.brandSub} numberOfLines={1}>
                  Executive Luxury Charter & Concierge Hub
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.brandTitle} numberOfLines={1}>
                  VELOCITI<Text style={styles.brandGold}>DRIVER</Text>
                </Text>
                <Text style={styles.brandSub} numberOfLines={1}>
                  In-Vehicle GPS Telemetry Broadcast
                </Text>
              </>
            )}
          </View>

          <View style={styles.headerRightActions}>
            {/* Signed-in Account Badge */}
            <TouchableOpacity
              style={[
                styles.userProfileChip,
                driverUser?.role === 'ADMIN' && { borderColor: 'rgba(0,212,255,0.4)', backgroundColor: 'rgba(0,212,255,0.08)' },
                driverUser?.role === 'CUSTOMER' && { borderColor: 'rgba(192,132,252,0.4)', backgroundColor: 'rgba(192,132,252,0.08)' },
              ]}
              onPress={handleAccountMenu}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.cockpitAvatarCircle,
                  { backgroundColor: driverUser?.avatarBg || (driverUser?.role === 'ADMIN' ? '#00d4ff' : driverUser?.role === 'CUSTOMER' ? '#c084fc' : '#1a73e8') },
                ]}
              >
                {driverUser?.photoURL ? (
                  <Image source={{ uri: driverUser.photoURL }} style={styles.cockpitAvatarImg} />
                ) : (
                  <Text style={[styles.cockpitAvatarText, (driverUser?.role === 'ADMIN' || driverUser?.role === 'CUSTOMER') && { color: '#070709' }]}>
                    {driverUser?.initial || driverUser?.name?.charAt(0) || 'U'}
                  </Text>
                )}
              </View>
              <View style={styles.userProfileTextCol}>
                <Text style={styles.userProfileName} numberOfLines={1}>
                  {driverUser?.name}
                </Text>
                <Text
                  style={[
                    styles.userProfileGoogle,
                    driverUser?.role === 'ADMIN' && { color: '#00d4ff' },
                    driverUser?.role === 'CUSTOMER' && { color: '#c084fc' },
                  ]}
                  numberOfLines={1}
                >
                  {driverUser?.role === 'ADMIN' ? '🛡️ Fleet Admin' : driverUser?.role === 'CUSTOMER' ? '👑 VIP Client' : '🚗 Chauffeur'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => setShowConfig(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.settingsIcon}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 1. ADMIN ROLE VIEW ──────────────────────────────── */}
        {driverUser?.role === 'ADMIN' && (
          <View>
            {/* Mode Selector Toggle: Master Dispatch Radar vs Driver Cockpit */}
            <View style={styles.adminModeRow}>
              <TouchableOpacity
                style={[styles.adminModeBtn, adminMode === 'dispatch' && styles.adminModeBtnActive]}
                activeOpacity={0.8}
                onPress={() => setAdminMode('dispatch')}
              >
                <Text style={[styles.adminModeBtnText, adminMode === 'dispatch' && styles.adminModeBtnTextActive]}>
                  🛡️ Master Dispatch Radar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.adminModeBtn, adminMode === 'cockpit' && styles.adminModeBtnActive]}
                activeOpacity={0.8}
                onPress={() => setAdminMode('cockpit')}
              >
                <Text style={[styles.adminModeBtnText, adminMode === 'cockpit' && styles.adminModeBtnTextActive]}>
                  🚗 Test Driver Cockpit
                </Text>
              </TouchableOpacity>
            </View>

            {adminMode === 'dispatch' && (
              <>
                {/* Fleet Operations KPI Grid */}
                <View style={styles.adminKpiGrid}>
                  <View style={styles.adminKpiCard}>
                    <Text style={styles.adminKpiValue}>{fleet.length || 6}</Text>
                    <Text style={styles.adminKpiLabel}>TOTAL FLEET UNITS</Text>
                  </View>
                  <View style={styles.adminKpiCard}>
                    <Text style={[styles.adminKpiValue, { color: '#34d399' }]}>
                      {onlineDrivers.length > 0 ? onlineDrivers.length : 2}
                    </Text>
                    <Text style={styles.adminKpiLabel}>ONLINE CHAUFFEURS</Text>
                  </View>
                  <View style={styles.adminKpiCard}>
                    <Text style={[styles.adminKpiValue, { color: '#fbbf24' }]}>
                      {fleet.filter((v) => v.status === 'RENTED').length || 1}
                    </Text>
                    <Text style={styles.adminKpiLabel}>ACTIVE CHARTERS</Text>
                  </View>
                  <View style={styles.adminKpiCard}>
                    <Text style={[styles.adminKpiValue, { color: '#c084fc' }]}>FIREBASE</Text>
                    <Text style={styles.adminKpiLabel}>RTDB SYNC READY</Text>
                  </View>
                </View>

                {/* Live Driver Presence List */}
                <View style={styles.adminCard}>
                  <View style={styles.adminCardHeaderRow}>
                    <Text style={styles.adminCardTitle}>📡 Live Chauffeur Heartbeats</Text>
                    <View style={styles.adminCardBadge}>
                      <View style={styles.liveBeaconDot} />
                      <Text style={styles.adminCardBadgeText}>FIREBASE PRESENCE</Text>
                    </View>
                  </View>

                  <Text style={styles.cardDesc}>
                    Real-time status of pilots streaming GPS telemetry to the central operations desk:
                  </Text>

                  {(onlineDrivers.length > 0
                    ? onlineDrivers
                    : [
                        {
                          email: 'carlos.diaz@velocitifleet.com',
                          driverName: 'Carlos Diaz (Senior Chauffeur)',
                          fleetId: 2,
                          online: true,
                          lastSeen: Date.now() - 5000,
                        },
                        {
                          email: 'eve@velocitifleet.com',
                          driverName: 'Eve Wilson (VIP Pilot)',
                          fleetId: 3,
                          online: true,
                          lastSeen: Date.now() - 12000,
                        },
                      ]
                  ).map((driver) => {
                    const assignedCar = fleet.find((f) => f.id === driver.fleetId);
                    return (
                      <View key={driver.email} style={styles.driverPresenceItem}>
                        <View style={styles.driverPresenceLeft}>
                          <View style={styles.driverPresenceAvatar}>
                            <Text style={styles.driverPresenceAvatarText}>
                              {driver.driverName ? driver.driverName.charAt(0) : 'P'}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.driverPresenceName} numberOfLines={1}>
                              {driver.driverName || driver.email}
                            </Text>
                            <Text style={styles.driverPresenceSub} numberOfLines={1}>
                              {assignedCar
                                ? `Operating ${assignedCar.make} ${assignedCar.model} (${assignedCar.registration})`
                                : `Vehicle #${driver.fleetId || 'Unassigned'}`}
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={{
                            paddingVertical: 5,
                            paddingHorizontal: 10,
                            borderRadius: 6,
                            backgroundColor: 'rgba(0,212,255,0.12)',
                            borderWidth: 1,
                            borderColor: 'rgba(0,212,255,0.35)',
                          }}
                          onPress={() => {
                            if (driver.fleetId) setTargetDispatchVehicleId(driver.fleetId);
                            Alert.alert(
                              'Chauffeur Selected',
                              `Target set to Vehicle #${driver.fleetId || 1} (${driver.driverName}).`
                            );
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#00d4ff' }}>Target Unit ›</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>

                {/* Remote Vehicle Dispatch Directive Console */}
                <View style={styles.adminCard}>
                  <View style={styles.adminCardHeaderRow}>
                    <Text style={styles.adminCardTitle}>⚡ Remote Vehicle Dispatch Directive</Text>
                    <View style={styles.adminCardBadge}>
                      <Text style={styles.adminCardBadgeText}>FIREBASE RELAY</Text>
                    </View>
                  </View>

                  <Text style={styles.cardDesc}>
                    Transmit high-priority remote directives to driver cockpits via Firebase RTDB path{' '}
                    <Text style={{ fontFamily: 'monospace', color: '#00d4ff' }}>
                      /dispatch/{targetDispatchVehicleId || (fleet[0]?.id || 1)}
                    </Text>:
                  </Text>

                  {/* Target Vehicle Horizontal Selector */}
                  <Text style={styles.authInputLabel}>TARGET FLEET VEHICLE</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                    {fleet.map((v) => {
                      const isTarget = (targetDispatchVehicleId || fleet[0]?.id) === v.id;
                      return (
                        <TouchableOpacity
                          key={v.id}
                          style={[
                            styles.vehicleChip,
                            isTarget && { borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,0.15)' },
                          ]}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setTargetDispatchVehicleId(v.id);
                          }}
                        >
                          <Text style={styles.vehicleIcon}>
                            {{ Car: '🚗', Scooter: '🛵', Motorcycle: '🏍️', Truck: '🚛', Van: '🚐' }[v.type] || '🚗'}
                          </Text>
                          <View style={styles.vehicleChipInfo}>
                            <Text style={[styles.vehicleChipName, isTarget && { color: '#00d4ff' }]} numberOfLines={1}>
                              {v.make} {v.model}
                            </Text>
                            <Text style={styles.vehicleChipReg} numberOfLines={1}>{v.registration}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* Directive Action Selector */}
                  <Text style={styles.authInputLabel}>DIRECTIVE ACTION TYPE</Text>
                  <View style={styles.adminActionSelector}>
                    <TouchableOpacity
                      style={[
                        styles.adminActionBtn,
                        dispatchAction === 'MESSAGE' && styles.adminActionBtnActive,
                      ]}
                      onPress={() => setDispatchAction('MESSAGE')}
                    >
                      <Text style={[styles.adminActionBtnText, dispatchAction === 'MESSAGE' && styles.adminActionBtnTextActive]}>
                        💬 Message
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.adminActionBtn,
                        dispatchAction === 'STOP_VEHICLE' && styles.adminActionBtnActiveStop,
                      ]}
                      onPress={() => setDispatchAction('STOP_VEHICLE')}
                    >
                      <Text style={[styles.adminActionBtnText, dispatchAction === 'STOP_VEHICLE' && { color: '#ef4444', fontWeight: '900' }]}>
                        🛑 Remote Halt
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.adminActionBtn,
                        dispatchAction === 'CHANGE_VEHICLE' && styles.adminActionBtnActive,
                      ]}
                      onPress={() => setDispatchAction('CHANGE_VEHICLE')}
                    >
                      <Text style={[styles.adminActionBtnText, dispatchAction === 'CHANGE_VEHICLE' && styles.adminActionBtnTextActive]}>
                        🔄 Swap Vehicle
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Directive Message Input */}
                  <Text style={styles.authInputLabel}>DISPATCH INSTRUCTION MESSAGE</Text>
                  <TextInput
                    style={styles.adminMessageInput}
                    placeholder="Enter directive message for driver cockpit HUD..."
                    placeholderTextColor="rgba(248,244,235,0.3)"
                    value={dispatchCustomMessage}
                    onChangeText={setDispatchCustomMessage}
                  />

                  {/* Quick message presets */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {[
                      'VIP client pickup at Terminal 3 now.',
                      'Halt safely at next emergency bay for inspection.',
                      'Return to Central Fleet Depot for maintenance.',
                    ].map((preset) => (
                      <TouchableOpacity
                        key={preset}
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.04)',
                          borderRadius: 6,
                          paddingVertical: 4,
                          paddingHorizontal: 8,
                          borderWidth: 1,
                          borderColor: 'rgba(255,255,255,0.08)',
                        }}
                        onPress={() => setDispatchCustomMessage(preset)}
                      >
                        <Text style={{ fontSize: 10, color: 'rgba(248,244,235,0.6)' }}>✦ {preset}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Transmit Command Button */}
                  <TouchableOpacity
                    style={[styles.adminDispatchTransmitBtn, isDispatching && { opacity: 0.7 }]}
                    activeOpacity={0.85}
                    disabled={isDispatching}
                    onPress={handleAdminDispatchCommand}
                  >
                    {isDispatching ? (
                      <ActivityIndicator size="small" color="#070709" />
                    ) : (
                      <Text style={styles.adminDispatchTransmitText}>
                        TRANSMIT DIRECTIVE TO VEHICLE #{targetDispatchVehicleId || (fleet[0]?.id || 1)} →
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Central Radar Integration Card */}
                <View style={styles.infoCard}>
                  <Text style={styles.infoTitle}>🌐 Central Operations Radar Synchronization</Text>
                  <Text style={styles.infoDesc}>
                    Live radar updates and commands are propagated in real-time across web and mobile clients via Google Firebase RTDB.
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* ── 2. CUSTOMER ROLE VIEW (VIP CLIENT) ─────────────── */}
        {driverUser?.role === 'CUSTOMER' && (
          <View>
            {/* VIP Membership Card */}
            <View style={styles.vipMembershipCard}>
              <View style={styles.vipCardHeader}>
                <View>
                  <Text style={styles.vipCardTitle}>VELOCITI BLACK VIP</Text>
                  <Text style={{ fontSize: 10, color: '#c084fc', fontWeight: '700', letterSpacing: 1 }}>
                    EXECUTIVE CHARTER PRIVILEGE
                  </Text>
                </View>
                <View style={styles.vipCardBadge}>
                  <Text style={styles.vipCardBadgeText}>TIER 1 CLIENT</Text>
                </View>
              </View>

              <View style={styles.vipMemberInfo}>
                <View style={styles.vipMemberAvatar}>
                  <Text style={styles.vipMemberAvatarText}>
                    {driverUser?.name ? driverUser.name.charAt(0) : 'V'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vipMemberName}>{driverUser?.name || 'VIP Executive'}</Text>
                  <Text style={styles.vipMemberEmail}>{driverUser?.email}</Text>
                  <Text style={{ fontSize: 10, color: '#34d399', fontWeight: '700', marginTop: 2 }}>
                    ✓ Biometric Clearance Active · Priority Dispatch
                  </Text>
                </View>
              </View>
            </View>

            {/* Active Luxury Charter & Assigned Chauffeur Card */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>👑 Reserved Luxury Charter</Text>
                <View
                  style={[
                    styles.liveBeaconBadge,
                    { borderColor: 'rgba(192,132,252,0.4)', backgroundColor: 'rgba(192,132,252,0.12)' },
                  ]}
                >
                  <View style={[styles.liveBeaconDot, { backgroundColor: '#c084fc' }]} />
                  <Text style={[styles.liveBeaconText, { color: '#c084fc' }]}>STANDBY PICKUP</Text>
                </View>
              </View>

              <Text style={styles.cardDesc}>
                Your private luxury transport is prepped and awaiting your travel itinerary:
              </Text>

              {/* Reserved Vehicle Display */}
              <View
                style={[
                  styles.assignedVehicleBox,
                  { borderColor: 'rgba(192,132,252,0.3)', backgroundColor: 'rgba(192,132,252,0.06)' },
                ]}
              >
                <View style={styles.assignedLeft}>
                  <Text style={styles.assignedMake}>
                    {selectedVehicle?.make || 'Mercedes-Maybach'} {selectedVehicle?.model || 'S-Class S680'}
                  </Text>
                  <Text style={styles.assignedPlate}>
                    {selectedVehicle?.registration || 'TN-01-MB-8888'} · Executive Luxury
                  </Text>
                </View>
                <View style={styles.assignedRight}>
                  <Text style={[styles.assignedStatusLabel, { color: '#c084fc' }]}>Cabin Climate</Text>
                  <Text style={[styles.assignedStatusVal, { color: '#ffffff' }]}>21.5°C Pre-Cooled</Text>
                </View>
              </View>

              {/* Assigned Chauffeur Details */}
              <View
                style={{
                  marginTop: 12,
                  padding: 12,
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.06)',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: 'rgba(212,175,55,0.2)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>👨‍✈️</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#ffffff' }}>Carlos Diaz</Text>
                    <Text style={{ fontSize: 10, color: 'rgba(248,244,235,0.5)' }}>
                      Senior Certified Protection Pilot · 5.0 ★ (1,420 Charters)
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: 'rgba(52,211,153,0.15)',
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ fontSize: 9, color: '#34d399', fontWeight: '800' }}>ON DUTY</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 11, color: 'rgba(248,244,235,0.6)', lineHeight: 15 }}>
                  Chauffeur is staged at the Executive Aviation Lounge with vehicle prepped. Real-time satellite
                  telemetry is active.
                </Text>
              </View>

              {/* Concierge Action Buttons */}
              <View style={styles.vipConciergeRow}>
                <TouchableOpacity
                  style={styles.vipConciergeBtn}
                  activeOpacity={0.8}
                  onPress={() => handleVipConciergeRequest('reposition')}
                >
                  <Text style={styles.vipConciergeBtnText}>✨ Request Reposition</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.vipConciergeBtn}
                  activeOpacity={0.8}
                  onPress={() => handleVipConciergeRequest('call')}
                >
                  <Text style={styles.vipConciergeBtnText}>📞 Call Concierge</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.vipConciergeBtn}
                  activeOpacity={0.8}
                  onPress={() => handleVipConciergeRequest('security')}
                >
                  <Text style={styles.vipConciergeBtnText}>🛡️ Escort Radar</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Executive Fleet Catalog Selector */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🏎️ Available Luxury Executive Fleet</Text>
              <Text style={styles.cardDesc}>
                Browse available ultra-luxury charters in Chennai ready for immediate VIP booking:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vehicleScroll}>
                {fleet.map((v) => {
                  const isSelected = v.id === selectedVehicleId;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[
                        styles.vehicleChip,
                        isSelected && { borderColor: '#c084fc', backgroundColor: 'rgba(192,132,252,0.12)' },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedVehicleId(v.id);
                      }}
                    >
                      <Text style={styles.vehicleIcon}>
                        {{ Car: '🚗', Scooter: '🛵', Motorcycle: '🏍️', Truck: '🚛', Van: '🚐' }[v.type] || '🚗'}
                      </Text>
                      <View style={styles.vehicleChipInfo}>
                        <Text style={[styles.vehicleChipName, isSelected && { color: '#c084fc' }]} numberOfLines={1}>
                          {v.make} {v.model}
                        </Text>
                        <Text style={styles.vehicleChipReg} numberOfLines={1}>{v.registration}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>🔒 Velociti Executive Guarantee</Text>
              <Text style={styles.infoDesc}>
                All VIP charters include Tier-1 discreet security, sanitized and climate-controlled cabins, and 24/7
                central dispatch tracking.
              </Text>
            </View>
          </View>
        )}

        {/* ── 3. CHAUFFEUR ROLE VIEW (or ADMIN in Cockpit Mode) ──── */}
        {(driverUser?.role === 'DRIVER' || (driverUser?.role === 'ADMIN' && adminMode === 'cockpit')) && (
          <View>
            {driverUser?.role === 'ADMIN' && (
              <View
                style={{
                  backgroundColor: 'rgba(0,212,255,0.1)',
                  borderWidth: 1,
                  borderColor: 'rgba(0,212,255,0.3)',
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Text style={{ fontSize: 16 }}>🛡️</Text>
                <Text style={{ fontSize: 11, color: '#00d4ff', fontWeight: '700', flex: 1 }}>
                  Admin Cockpit Simulator Active — Broadcast live phone GPS as test chauffeur.
                </Text>
              </View>
            )}

            {/* ── Vehicle Selector: Which car are you driving? ────── */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>🚗 Active Vehicle</Text>
                {isDriving && (
                  <View style={styles.liveBeaconBadge}>
                    <View style={styles.liveBeaconDot} />
                    <Text style={styles.liveBeaconText}>TRACKING ACTIVE</Text>
                  </View>
                )}
              </View>

              <Text style={styles.cardDesc}>
                Select the vehicle you are operating. Your phone&apos;s GPS streams live to fleet dispatch with your driver identity.
              </Text>

              {loading ? (
                <ActivityIndicator color="#d4af37" style={{ marginVertical: 12 }} />
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.vehicleScrollContainer}
                  style={styles.vehicleScroll}
                >
                  {fleet.map((v) => {
                    const isSelected = v.id === selectedVehicleId;
                    return (
                      <TouchableOpacity
                        key={v.id}
                        disabled={isDriving}
                        style={[
                          styles.vehicleChip,
                          isSelected && styles.vehicleChipActive,
                          isDriving && !isSelected && { opacity: 0.4 },
                        ]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setSelectedVehicleId(v.id);
                        }}
                      >
                        <Text style={styles.vehicleIcon}>
                          {{ Car: '🚗', Scooter: '🛵', Motorcycle: '🏍️', Truck: '🚛', Van: '🚐' }[v.type] || '🚗'}
                        </Text>
                        <View style={styles.vehicleChipInfo}>
                          <Text style={[styles.vehicleChipName, isSelected && styles.goldText]} numberOfLines={1}>
                            {v.make} {v.model}
                          </Text>
                          <Text style={styles.vehicleChipReg} numberOfLines={1}>{v.registration}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* Active vehicle badge */}
              {selectedVehicle && (
                <View style={styles.assignedVehicleBox}>
                  <View style={styles.assignedLeft}>
                    <Text style={styles.assignedMake} numberOfLines={1}>
                      {selectedVehicle.make} {selectedVehicle.model}
                    </Text>
                    <Text style={styles.assignedPlate} numberOfLines={1}>
                      {selectedVehicle.registration} · {driverUser?.name}
                    </Text>
                  </View>
                  <View style={styles.assignedRight}>
                    <Text style={styles.assignedStatusLabel}>Fleet Status</Text>
                    <Text style={styles.assignedStatusVal}>{selectedVehicle.status}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* ── Firebase Dispatch Alert Banner (web → app commands) ── */}
            {dispatchMsg && (
              <View
                style={{
                  marginBottom: 10,
                  borderRadius: 12,
                  backgroundColor: 'rgba(251,191,36,0.12)',
                  borderWidth: 1,
                  borderColor: 'rgba(251,191,36,0.4)',
                  padding: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Text style={{ fontSize: 22 }}>
                  {dispatchMsg.action === 'STOP_VEHICLE' ? '🛑' : dispatchMsg.action === 'CHANGE_VEHICLE' ? '🔄' : '📡'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fbbf24', fontWeight: '800', fontSize: 11, letterSpacing: 1 }}>
                    FLEET DISPATCH
                  </Text>
                  <Text style={{ color: '#fff', fontSize: 12, marginTop: 2 }} numberOfLines={2}>
                    {dispatchMsg.message || dispatchMsg.action}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setDispatchMsg(null)}>
                  <Text style={{ color: '#6b7280', fontSize: 18 }}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── In-Cab Driving Cockpit HUD (Speedometer & Telemetry) ── */}
            <View style={styles.cockpitCard}>
              <View style={styles.cockpitHeaderRow}>
                <Text style={styles.cockpitLabel}>LIVE VEHICLE TELEMETRY</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {/* Firebase sync status badge */}
                  {isDriving && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 3,
                        backgroundColor:
                          firebaseStatus === 'synced'
                            ? 'rgba(52,211,153,0.15)'
                            : firebaseStatus === 'error'
                            ? 'rgba(251,191,36,0.15)'
                            : 'rgba(255,255,255,0.06)',
                        borderRadius: 8,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderWidth: 1,
                        borderColor:
                          firebaseStatus === 'synced'
                            ? 'rgba(52,211,153,0.4)'
                            : firebaseStatus === 'error'
                            ? 'rgba(251,191,36,0.4)'
                            : 'rgba(255,255,255,0.1)',
                      }}
                    >
                      <Text style={{ fontSize: 9 }}>
                        {firebaseStatus === 'synced' ? '🔥' : firebaseStatus === 'error' ? '⚡' : '⬡'}
                      </Text>
                      <Text
                        style={{
                          fontSize: 9,
                          fontWeight: '800',
                          color:
                            firebaseStatus === 'synced'
                              ? '#34d399'
                              : firebaseStatus === 'error'
                              ? '#fbbf24'
                              : '#6b7280',
                          letterSpacing: 0.5,
                        }}
                      >
                        {firebaseStatus === 'synced' ? 'FIREBASE' : firebaseStatus === 'error' ? 'REST' : 'IDLE'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.cockpitStatusBadge}>
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: isDriving ? '#34d399' : '#f87171' },
                      ]}
                    />
                    <Text
                      style={[
                        styles.cockpitStatus,
                        { color: isDriving ? '#34d399' : '#f87171' },
                      ]}
                      numberOfLines={1}
                    >
                      {isDriving
                        ? isSimulating
                          ? 'SIMULATOR ACTIVE'
                          : 'STREAMING GPS'
                        : 'STANDBY'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Digital Speedometer */}
              <View style={styles.speedometerContainer}>
                <View style={styles.speedValueRow}>
                  <Text style={styles.speedNumber}>{currentSpeedKmh}</Text>
                  <Text style={styles.speedUnit}>KM/H</Text>
                </View>
                <Text style={styles.speedSub}>DIGITAL HUD SPEEDOMETER</Text>
              </View>

              {/* Live Metrics Grid - 2x2 Clean Mobile Tiles */}
              <View style={styles.metricsGrid}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel} numberOfLines={1}>COMPASS HEADING</Text>
                  <Text style={styles.metricValue} numberOfLines={1}>
                    {getHeadingText(currentHeading)} ({currentHeading}°)
                  </Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel} numberOfLines={1}>DISTANCE COVERED</Text>
                  <Text style={[styles.metricValue, { color: '#f7e199' }]} numberOfLines={1}>
                    {tripDistanceKm} km
                  </Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel} numberOfLines={1}>TRIP DURATION</Text>
                  <Text style={styles.metricValue} numberOfLines={1}>{formatTimer(tripSeconds)}</Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel} numberOfLines={1}>RADAR PINGS</Text>
                  <Text style={[styles.metricValue, { color: '#34d399' }]} numberOfLines={1}>
                    {pingsStreamed} pings
                  </Text>
                </View>
              </View>

              {/* Coordinates Bar */}
              <View style={styles.coordsBar}>
                <Text style={styles.coordsText} numberOfLines={1}>
                  GPS:{' '}
                  {currentGps
                    ? `${currentGps.latitude.toFixed(5)}, ${currentGps.longitude.toFixed(5)}`
                    : 'Awaiting GPS Fix...'}
                </Text>
                <Text style={styles.coordsAccuracy} numberOfLines={1}>
                  {currentGps?.accuracy ? `±${Math.round(currentGps.accuracy)}m` : '—'}
                </Text>
              </View>
            </View>

            {/* ── Primary Driving Action Controls ────────────────── */}
            <View style={styles.actionCard}>
              {!isDriving ? (
                <TouchableOpacity
                  style={styles.startDrivingBtn}
                  onPress={startDriving}
                  activeOpacity={0.85}
                >
                  <Text style={styles.startDrivingIcon}>🟢</Text>
                  <View style={styles.drivingBtnContent}>
                    <Text style={styles.startDrivingTitle} numberOfLines={1}>
                      START DRIVING {selectedVehicle?.make?.toUpperCase()}
                    </Text>
                    <Text style={styles.startDrivingSub} numberOfLines={1}>
                      Broadcast live phone GPS telemetry to dispatch
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.stopDrivingBtn}
                  onPress={stopDriving}
                  activeOpacity={0.85}
                >
                  <Text style={styles.stopDrivingIcon}>🔴</Text>
                  <View style={styles.drivingBtnContent}>
                    <Text style={styles.stopDrivingTitle} numberOfLines={1}>
                      END DRIVE & PARK VEHICLE
                    </Text>
                    <Text style={styles.stopDrivingSub} numberOfLines={1}>
                      Stop streaming & record final parked position
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* Secondary test button */}
              <View style={styles.auxRow}>
                {!isDriving && (
                  <TouchableOpacity
                    style={styles.auxBtn}
                    onPress={startSimulation}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.auxBtnText}>🧪 Test Drive Simulation (Marina Beach)</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* ── Central Radar Preview Link ─────────────────────── */}
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>🌐 Central Radar Map Integration</Text>
              <Text style={styles.infoDesc}>
                While driving is active, anyone viewing the central website map will see{' '}
                <Text style={{ fontWeight: '800', color: '#fff' }}>
                  {selectedVehicle?.make} {selectedVehicle?.model} ({selectedVehicle?.registration})
                </Text>{' '}
                moving live in Chennai driven by{' '}
                <Text style={{ fontWeight: '800', color: '#34d399' }}>{driverUser?.name}</Text>.
              </Text>
            </View>
          </View>
        )}

        {/* ── Backend Settings Modal ────────────────────────── */}
        <Modal visible={showConfig} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Backend API Endpoint</Text>
              <Text style={styles.modalSub}>
                Configure where your phone streams GPS telemetry:
              </Text>

              <TextInput
                style={styles.input}
                value={apiUrl}
                onChangeText={setApiUrl}
                placeholder="https://frontend-weld-seven-80.vercel.app"
                placeholderTextColor="#666"
                autoCapitalize="none"
              />

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setShowConfig(false)}
                >
                  <Text style={styles.modalCloseText}>Save Endpoint</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070709',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0,
  },
  loadingSafeArea: {
    flex: 1,
    backgroundColor: '#070709',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0,
  },
  loadingText: {
    color: '#d4af37',
    marginTop: 12,
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
  },
  container: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 32,
  },

  // ── Authentication Screen Styles ─────────────────────
  authScrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 16,
    paddingBottom: 28,
  },
  authHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  authEmblem: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: 1.5,
    borderColor: '#d4af37',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#d4af37',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  authEmblemEmoji: {
    fontSize: 32,
  },
  authBrandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1.2,
  },
  authBrandSub: {
    fontSize: 12,
    color: 'rgba(248,244,235,0.6)',
    marginTop: 3,
    textAlign: 'center',
  },
  authCard: {
    backgroundColor: '#121217',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.22)',
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  roleSelectorBox: {
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    padding: 10,
  },
  roleSelectorLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(212,175,55,0.85)',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  roleSegmentRow: {
    flexDirection: 'row',
    gap: 6,
  },
  roleSegmentBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  roleSegmentBtnActiveDriver: {
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderColor: '#d4af37',
  },
  roleSegmentBtnActiveAdmin: {
    backgroundColor: 'rgba(0,212,255,0.15)',
    borderColor: '#00d4ff',
  },
  roleSegmentBtnActiveClient: {
    backgroundColor: 'rgba(192,132,252,0.15)',
    borderColor: '#c084fc',
  },
  roleSegmentEmoji: {
    fontSize: 16,
    marginBottom: 3,
  },
  roleSegmentText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(248,244,235,0.55)',
  },
  roleSegmentTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  authTabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    gap: 4,
  },
  authTabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  authTabBtnActive: {
    backgroundColor: '#d4af37',
    shadowColor: '#d4af37',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 2,
  },
  authTabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(248,244,235,0.55)',
  },
  authTabBtnTextActive: {
    color: '#070709',
    fontWeight: '900',
  },
  authTabContent: {
    width: '100%',
  },
  independentBrandBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: 1.5,
    borderColor: '#d4af37',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  independentBadgeEmoji: {
    fontSize: 18,
  },
  authErrorBanner: {
    backgroundColor: 'rgba(234,67,53,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(234,67,53,0.35)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  authErrorText: {
    color: '#ff8a80',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  authFieldGroup: {
    marginBottom: 10,
  },
  authInputLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(212,175,55,0.85)',
    letterSpacing: 0.7,
    marginBottom: 5,
  },
  authTextInput: {
    backgroundColor: '#0a0a0f',
    borderWidth: 1.2,
    borderColor: 'rgba(212,175,55,0.22)',
    borderRadius: 11,
    paddingVertical: 10,
    paddingHorizontal: 13,
    color: '#ffffff',
    fontSize: 13,
  },
  independentSubmitBtn: {
    backgroundColor: '#d4af37',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 8,
    shadowColor: '#d4af37',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  independentSubmitText: {
    color: '#070709',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  authToggleLink: {
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 10,
  },
  authToggleLinkText: {
    fontSize: 11,
    color: '#d4af37',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  instantAccessCard: {
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  instantAccessHeader: {
    marginBottom: 8,
  },
  instantAccessTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(212,175,55,0.85)',
    letterSpacing: 0.8,
  },
  instantAccessDesc: {
    fontSize: 10,
    color: 'rgba(248,244,235,0.45)',
    marginTop: 2,
    lineHeight: 14,
  },
  instantAccessBtnsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  instantAccessBtn: {
    flex: 1,
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    borderRadius: 9,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instantAccessBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f8f4eb',
  },
  authCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  authCardHeaderText: {
    flex: 1,
  },
  googleBrandBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
    flexShrink: 0,
  },
  authCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fcfaf6',
  },
  firebaseBadge: {
    backgroundColor: 'rgba(255,152,0,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,152,0,0.4)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  firebaseBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ff9800',
    letterSpacing: 0.3,
  },
  authCardDesc: {
    fontSize: 11,
    color: 'rgba(248,244,235,0.55)',
    lineHeight: 15,
    marginTop: 2,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  googleGLetter: {
    fontSize: 16,
    fontWeight: '900',
    color: '#4285F4',
  },
  googleBtnText: {
    color: '#1f2937',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  deviceAccountsCard: {
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
    padding: 10,
  },
  deviceAccountsLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(212,175,55,0.85)',
    letterSpacing: 0.7,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  deviceAccountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: 6,
    gap: 8,
  },
  accAvatarCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  accAvatarImg: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  accAvatarInitial: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  deviceAccountInfo: {
    flex: 1,
    marginRight: 4,
  },
  deviceAccountName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  deviceAccountEmail: {
    fontSize: 10,
    color: 'rgba(248,244,235,0.45)',
    marginTop: 1,
  },
  deviceAccountArrow: {
    fontSize: 16,
    color: 'rgba(248,244,235,0.3)',
    fontWeight: '700',
    flexShrink: 0,
  },
  allAccountsLink: {
    alignItems: 'center',
    paddingVertical: 6,
    marginTop: 2,
  },
  allAccountsLinkText: {
    fontSize: 11,
    color: '#d4af37',
    fontWeight: '700',
  },

  // ── Google Account Chooser Bottom Sheet ──────────────
  googleModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  googleSheetContainer: {
    backgroundColor: '#202124',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 32 : 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#303134',
    maxHeight: '88%',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 16,
  },
  googleSheetHandle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#5f6368',
    alignSelf: 'center',
    marginBottom: 12,
  },
  googleSheetHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  googleLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  googleLogoTextG: { fontSize: 18, fontWeight: '800', color: '#4285F4' },
  googleLogoTextO1: { fontSize: 18, fontWeight: '800', color: '#EA4335' },
  googleLogoTextO2: { fontSize: 18, fontWeight: '800', color: '#FBBC05' },
  googleLogoTextG2: { fontSize: 18, fontWeight: '800', color: '#4285F4' },
  googleLogoTextL: { fontSize: 18, fontWeight: '800', color: '#34A853' },
  googleLogoTextE: { fontSize: 18, fontWeight: '800', color: '#EA4335' },
  googleSheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e8eaed',
    marginTop: 2,
  },
  googleSheetSubtitle: {
    fontSize: 11,
    color: '#9aa0a6',
    marginTop: 2,
    textAlign: 'center',
  },
  googleSheetDivider: {
    height: 1,
    backgroundColor: '#303134',
    marginVertical: 10,
  },
  googleAccountsList: {
    maxHeight: 280,
  },
  googleAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 4,
    gap: 12,
  },
  googleAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  googleAvatarText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  googleAccountInfo: {
    flex: 1,
    marginRight: 4,
  },
  googleAccountName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e8eaed',
  },
  googleAccountEmail: {
    fontSize: 11,
    color: '#9aa0a6',
    marginTop: 1,
  },
  googleAccountArrow: {
    fontSize: 18,
    color: '#5f6368',
    fontWeight: '600',
    flexShrink: 0,
  },
  googleAddAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#303134',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  googleAddIcon: {
    fontSize: 16,
    color: '#8ab4f8',
    fontWeight: '700',
  },
  googleAddAccountText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8ab4f8',
  },
  addAccountBox: {
    backgroundColor: '#303134',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  addAccountHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e8eaed',
    marginBottom: 8,
  },
  googleInput: {
    backgroundColor: '#202124',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#5f6368',
    paddingVertical: 7,
    paddingHorizontal: 10,
    color: '#e8eaed',
    fontSize: 12,
    marginBottom: 8,
  },
  addAccountActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  googleCancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  googleCancelText: {
    fontSize: 11,
    color: '#9aa0a6',
    fontWeight: '700',
  },
  googleSubmitBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#1a73e8',
  },
  googleSubmitText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '700',
  },
  googleSheetFooter: {
    paddingTop: 2,
  },
  googleDisclaimer: {
    fontSize: 10,
    color: '#9aa0a6',
    lineHeight: 14,
    textAlign: 'center',
  },
  cockpitAvatarCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  cockpitAvatarImg: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  cockpitAvatarText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },

  // ── Main Cockpit Styles ──────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.18)',
  },
  headerBrand: {
    flex: 1,
    marginRight: 8,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1,
  },
  brandGold: {
    color: '#d4af37',
  },
  brandSub: {
    fontSize: 10,
    color: 'rgba(248,244,235,0.45)',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  userProfileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    borderRadius: 18,
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 6,
    maxWidth: 125,
  },
  userProfileTextCol: {
    flexShrink: 1,
  },
  userProfileName: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
  },
  userProfileGoogle: {
    fontSize: 8,
    color: '#34d399',
    fontWeight: '700',
  },
  settingsBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 14,
  },
  card: {
    backgroundColor: '#121217',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    padding: 14,
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fcfaf6',
    flexShrink: 1,
  },
  liveBeaconBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52,211,153,0.12)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.4)',
    gap: 5,
    flexShrink: 0,
  },
  liveBeaconDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34d399',
  },
  liveBeaconText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#34d399',
    letterSpacing: 0.5,
  },
  cardDesc: {
    fontSize: 11,
    color: 'rgba(248,244,235,0.55)',
    marginTop: 4,
    marginBottom: 10,
    lineHeight: 16,
  },
  vehicleScroll: {
    marginBottom: 10,
  },
  vehicleScrollContainer: {
    paddingRight: 10,
  },
  vehicleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginRight: 8,
    gap: 8,
  },
  vehicleChipActive: {
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderColor: '#d4af37',
  },
  vehicleIcon: {
    fontSize: 18,
    flexShrink: 0,
  },
  vehicleChipInfo: {
    maxWidth: 120,
  },
  vehicleChipName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  vehicleChipReg: {
    fontSize: 9,
    color: 'rgba(248,244,235,0.45)',
    marginTop: 1,
  },
  goldText: {
    color: '#f7e199',
  },
  assignedVehicleBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.22)',
    padding: 10,
  },
  assignedLeft: {
    flex: 1,
    marginRight: 8,
  },
  assignedMake: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  assignedPlate: {
    fontSize: 11,
    color: 'rgba(248,244,235,0.55)',
    marginTop: 2,
  },
  assignedRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  assignedStatusLabel: {
    fontSize: 9,
    color: 'rgba(248,244,235,0.4)',
    fontWeight: '700',
  },
  assignedStatusVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#34d399',
    marginTop: 1,
  },
  cockpitCard: {
    backgroundColor: '#0c0c10',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.25)',
    padding: 14,
    marginBottom: 12,
    shadowColor: '#d4af37',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  cockpitHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  cockpitLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(248,244,235,0.45)',
    letterSpacing: 1,
    flexShrink: 1,
  },
  cockpitStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexShrink: 0,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  cockpitStatus: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  speedometerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    paddingVertical: 6,
  },
  speedValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  speedNumber: {
    fontSize: 64,
    fontWeight: '900',
    color: '#ffffff',
    lineHeight: 68,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  speedUnit: {
    fontSize: 14,
    fontWeight: '900',
    color: '#d4af37',
    letterSpacing: 1.5,
  },
  speedSub: {
    fontSize: 9,
    color: 'rgba(248,244,235,0.35)',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  metricItem: {
    width: '48.5%',
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  metricLabel: {
    fontSize: 9,
    color: 'rgba(248,244,235,0.4)',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  coordsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  coordsText: {
    flex: 1,
    marginRight: 6,
    fontSize: 10,
    color: 'rgba(248,244,235,0.55)',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  coordsAccuracy: {
    fontSize: 10,
    color: '#34d399',
    fontWeight: '700',
    flexShrink: 0,
  },
  actionCard: {
    marginBottom: 12,
  },
  startDrivingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d4af37',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 12,
    shadowColor: '#d4af37',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  startDrivingIcon: {
    fontSize: 22,
    flexShrink: 0,
  },
  drivingBtnContent: {
    flex: 1,
  },
  startDrivingTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#070709',
    letterSpacing: 0.4,
  },
  startDrivingSub: {
    fontSize: 10,
    color: 'rgba(7,7,9,0.75)',
    marginTop: 2,
  },
  stopDrivingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 12,
    shadowColor: '#dc2626',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  stopDrivingIcon: {
    fontSize: 22,
    flexShrink: 0,
  },
  stopDrivingTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.4,
  },
  stopDrivingSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  auxRow: {
    marginTop: 8,
    alignItems: 'center',
  },
  auxBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  auxBtnText: {
    color: 'rgba(248,244,235,0.65)',
    fontSize: 11,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: 'rgba(18,18,24,0.6)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 12,
    marginBottom: 14,
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  infoDesc: {
    fontSize: 11,
    color: 'rgba(248,244,235,0.55)',
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#16161e',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    padding: 16,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 11,
    color: 'rgba(248,244,235,0.55)',
    marginBottom: 12,
    lineHeight: 15,
  },
  input: {
    backgroundColor: '#0c0c10',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    borderRadius: 8,
    padding: 10,
    color: '#ffffff',
    fontSize: 12,
    marginBottom: 12,
  },
  modalFooter: {
    alignItems: 'flex-end',
  },
  modalCloseBtn: {
    backgroundColor: '#d4af37',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalCloseText: {
    color: '#070709',
    fontWeight: '800',
    fontSize: 12,
  },

  // ── Admin Mode Styles ──────────────────────────────
  adminModeRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,212,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.25)',
    padding: 4,
    marginBottom: 12,
    gap: 4,
  },
  adminModeBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  adminModeBtnActive: {
    backgroundColor: '#00d4ff',
    shadowColor: '#00d4ff',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  adminModeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(248,244,235,0.65)',
  },
  adminModeBtnTextActive: {
    color: '#070709',
    fontWeight: '900',
  },
  adminKpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
    marginBottom: 12,
  },
  adminKpiCard: {
    width: '48.5%',
    backgroundColor: '#121217',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.18)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  adminKpiValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#00d4ff',
  },
  adminKpiLabel: {
    fontSize: 9,
    color: 'rgba(248,244,235,0.45)',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  adminCard: {
    backgroundColor: '#121217',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.22)',
    padding: 14,
    marginBottom: 12,
  },
  adminCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  adminCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  adminCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,212,255,0.12)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.3)',
    gap: 4,
  },
  adminCardBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#00d4ff',
    letterSpacing: 0.5,
  },
  driverPresenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  driverPresenceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  driverPresenceAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,212,255,0.15)',
    borderWidth: 1,
    borderColor: '#00d4ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverPresenceAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#00d4ff',
  },
  driverPresenceName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  driverPresenceSub: {
    fontSize: 10,
    color: 'rgba(248,244,235,0.45)',
    marginTop: 1,
  },
  adminActionSelector: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
    marginTop: 6,
  },
  adminActionBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  adminActionBtnActive: {
    backgroundColor: 'rgba(0,212,255,0.18)',
    borderColor: '#00d4ff',
  },
  adminActionBtnActiveStop: {
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderColor: '#ef4444',
  },
  adminActionBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(248,244,235,0.6)',
  },
  adminActionBtnTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  adminMessageInput: {
    backgroundColor: '#0a0a0f',
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.2)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    color: '#ffffff',
    fontSize: 12,
    marginBottom: 10,
  },
  adminDispatchTransmitBtn: {
    backgroundColor: '#00d4ff',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00d4ff',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  adminDispatchTransmitText: {
    color: '#070709',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // ── VIP Role Styles ────────────────────────────────
  vipMembershipCard: {
    backgroundColor: '#161024',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(192,132,252,0.3)',
    padding: 16,
    marginBottom: 12,
  },
  vipCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  vipCardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  vipCardBadge: {
    backgroundColor: 'rgba(192,132,252,0.15)',
    borderWidth: 1,
    borderColor: '#c084fc',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  vipCardBadgeText: {
    color: '#c084fc',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  vipMemberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vipMemberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(192,132,252,0.2)',
    borderWidth: 1.5,
    borderColor: '#c084fc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vipMemberAvatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#c084fc',
  },
  vipMemberName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  vipMemberEmail: {
    fontSize: 11,
    color: 'rgba(248,244,235,0.5)',
    marginTop: 2,
  },
  vipConciergeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  vipConciergeBtn: {
    flex: 1,
    backgroundColor: 'rgba(192,132,252,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.3)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vipConciergeBtnText: {
    color: '#c084fc',
    fontSize: 11,
    fontWeight: '800',
  },
});
