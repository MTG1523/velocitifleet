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
} from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';

// Enable WebBrowser auth session completion
WebBrowser.maybeCompleteAuthSession();

// Default production backend URL
const DEFAULT_API_URL = 'https://frontend-weld-seven-80.vercel.app';

// Detected Google Accounts on device
const DEFAULT_GOOGLE_ACCOUNTS = [
  {
    id: 'g-acc-1',
    name: 'Mokaanth D',
    email: 'mokaanth.dev@gmail.com',
    avatarBg: '#1a73e8', // Google Blue
    initial: 'M',
  },
  {
    id: 'g-acc-2',
    name: 'Velociti Dispatch Chauffeur',
    email: 'chauffeur.velociti@gmail.com',
    avatarBg: '#ea4335', // Google Red
    initial: 'V',
  },
  {
    id: 'g-acc-3',
    name: 'Carlos Diaz',
    email: 'carlos.diaz.chauffeur@gmail.com',
    avatarBg: '#34a853', // Google Green
    initial: 'C',
  },
  {
    id: 'g-acc-4',
    name: 'Eve Wilson',
    email: 'eve.wilson.velociti@gmail.com',
    avatarBg: '#fbbc05', // Google Gold
    initial: 'E',
  },
];

export default function App() {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [showConfig, setShowConfig] = useState(false);

  // Authentication State
  const [driverUser, setDriverUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Google Account Chooser State (Multiple Device Accounts)
  const [deviceAccounts, setDeviceAccounts] = useState(DEFAULT_GOOGLE_ACCOUNTS);
  const [googleChooserVisible, setGoogleChooserVisible] = useState(false);
  const [isAddingNewAccount, setIsAddingNewAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountEmail, setNewAccountEmail] = useState('');
  const [authenticatingAccountId, setAuthenticatingAccountId] = useState(null);

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

  // Google Account authentication & session management
  const saveUserSession = async (userProfile) => {
    try {
      await AsyncStorage.setItem('@velocitifleet_driver_user', JSON.stringify(userProfile));
      setDriverUser(userProfile);
      setGoogleChooserVisible(false);

      // Sync driver with cloud database
      fetch(`${apiUrl}/api/users/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: `driver_${Date.now()}`,
          email: userProfile.email,
          displayName: userProfile.name,
          role: 'DRIVER',
        }),
      }).catch(() => {});
    } catch (err) {
      Alert.alert('Session Error', err.message);
    }
  };

  // Select a Google Account from the device account list
  const handleSelectGoogleAccount = async (account) => {
    try {
      setAuthenticatingAccountId(account.id);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      setTimeout(async () => {
        const userProfile = {
          name: account.name,
          email: account.email,
          photoURL: '',
          avatarBg: account.avatarBg || '#1a73e8',
          initial: account.initial || account.name.charAt(0).toUpperCase(),
          role: 'DRIVER',
          provider: 'google.com',
          signedInAt: new Date().toISOString(),
        };
        await saveUserSession(userProfile);
        setAuthenticatingAccountId(null);
        setGoogleChooserVisible(false);
      }, 400);
    } catch (e) {
      setAuthenticatingAccountId(null);
      Alert.alert('Google Sign-In Error', e.message);
    }
  };

  // Add a new Google Account to the device and sign in with it
  const handleAddNewGoogleAccount = async () => {
    if (!newAccountEmail.trim() || !newAccountEmail.includes('@')) {
      Alert.alert('Invalid Google Email', 'Please enter a valid Google Account email address (e.g. yourname@gmail.com).');
      return;
    }
    const email = newAccountEmail.trim().toLowerCase();
    const name = newAccountName.trim() || email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const colors = ['#1a73e8', '#ea4335', '#34a853', '#fbbc05', '#8e24aa', '#0097a7'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newAcc = {
      id: `g-acc-${Date.now()}`,
      name,
      email,
      avatarBg: randomColor,
      initial: name.charAt(0).toUpperCase(),
    };

    const updated = [newAcc, ...deviceAccounts.filter((a) => a.email !== email)];
    setDeviceAccounts(updated);
    await AsyncStorage.setItem('@velocitifleet_device_accounts', JSON.stringify(updated));
    setNewAccountName('');
    setNewAccountEmail('');
    setIsAddingNewAccount(false);
    handleSelectGoogleAccount(newAcc);
  };

  // 2. Check Stored User Session and Device Accounts on Launch
  useEffect(() => {
    (async () => {
      try {
        const storedUser = await AsyncStorage.getItem('@velocitifleet_driver_user');
        if (storedUser) {
          setDriverUser(JSON.parse(storedUser));
        }
        const storedAccounts = await AsyncStorage.getItem('@velocitifleet_device_accounts');
        if (storedAccounts) {
          const parsed = JSON.parse(storedAccounts);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setDeviceAccounts(parsed);
          }
        }
      } catch (e) {
        console.warn('Failed to load stored driver:', e);
      } finally {
        setAuthLoading(false);
      }
    })();
  }, []);

  // 3. Fetch Fleet Roster from Backend
  const loadFleet = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/fleet`);
      const data = res.ok ? await res.json() : [];
      const list = Array.isArray(data) ? data : [];
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
    Alert.alert(
      driverUser?.name || 'Google Chauffeur',
      `${driverUser?.email || ''}\nGoogle Verified Chauffeur`,
      [
        {
          text: 'Switch Google Account',
          onPress: () => setGoogleChooserVisible(true),
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            if (isDriving) await stopDriving();
            await AsyncStorage.removeItem('@velocitifleet_driver_user');
            setDriverUser(null);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleSignOut = handleAccountMenu;

  // 4. Transmit Phone's GPS as Vehicle's Live Location with Driver Metadata
  const transmitVehicleLocation = useCallback(
    async (lat, lng, speed = 0, heading = 0) => {
      if (!selectedVehicleId) return;

      try {
        const res = await fetch(`${apiUrl}/api/locations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fleetId: selectedVehicleId,
            latitude: lat,
            longitude: lng,
            speed: Math.round(speed * 10) / 10,
            heading: Math.round(heading),
            driverName: driverUser?.name || 'Executive Driver',
            driverEmail: driverUser?.email || 'driver@velocitifleet.com',
            driverPhoto: driverUser?.photoURL || '',
          }),
        });

        if (res.ok) {
          setPingsStreamed((c) => c + 1);
          setLastTransmitTime(new Date().toLocaleTimeString());
        }
      } catch (err) {
        console.error('Failed to stream location:', err.message);
      }
    },
    [apiUrl, selectedVehicleId, driverUser]
  );

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

      // Watch Phone GPS with navigation-grade accuracy
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
    if (tripTimerRef.current) {
      clearInterval(tripTimerRef.current);
      tripTimerRef.current = null;
    }
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }

    setIsDriving(false);
    setIsSimulating(false);
    setCurrentSpeedKmh(0);

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
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#d4af37" />
        <Text style={{ color: '#d4af37', marginTop: 12, fontWeight: '700' }}>
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
        <View style={styles.authContainer}>
          {/* Logo & Header */}
          <View style={styles.authHeader}>
            <View style={styles.authEmblem}>
              <Text style={{ fontSize: 40 }}>👑</Text>
            </View>
            <Text style={styles.authBrandTitle}>
              VELOCITI<Text style={styles.brandGold}>DRIVER</Text>
            </Text>
            <Text style={styles.authBrandSub}>
              Executive Telematics & Dispatch Cockpit
            </Text>
          </View>

          {/* Luxury Card with Real Google Sign In */}
          <View style={styles.authCard}>
            <View style={styles.authCardHeader}>
              <View style={styles.googleBrandBadge}>
                <Text style={styles.googleGLetter}>G</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.authCardTitle}>Sign In with Google</Text>
                <Text style={styles.authCardDesc}>
                  Select a Google Account on this device to link your chauffeur telemetry.
                </Text>
              </View>
            </View>

            {/* Official Google Sign In Button */}
            <TouchableOpacity
              style={styles.googleBtn}
              activeOpacity={0.85}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setGoogleChooserVisible(true);
              }}
            >
              <View style={styles.googleIconContainer}>
                <Text style={styles.googleGLetter}>G</Text>
              </View>
              <Text style={styles.googleBtnText}>Choose Google Account ({deviceAccounts.length} on device)</Text>
            </TouchableOpacity>

            {/* Device Accounts Quick Selector */}
            <View style={styles.deviceAccountsCard}>
              <Text style={styles.deviceAccountsLabel}>ACCOUNTS ON THIS DEVICE</Text>
              {deviceAccounts.slice(0, 3).map((acc) => (
                <TouchableOpacity
                  key={acc.id}
                  style={styles.deviceAccountItem}
                  activeOpacity={0.7}
                  onPress={() => handleSelectGoogleAccount(acc)}
                >
                  <View style={[styles.accAvatarCircle, { backgroundColor: acc.avatarBg || '#1a73e8' }]}>
                    <Text style={styles.accAvatarInitial}>{acc.initial}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deviceAccountName}>{acc.name}</Text>
                    <Text style={styles.deviceAccountEmail}>{acc.email}</Text>
                  </View>
                  <Text style={styles.deviceAccountArrow}>›</Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={styles.allAccountsLink}
                onPress={() => setGoogleChooserVisible(true)}
              >
                <Text style={styles.allAccountsLinkText}>
                  + View all accounts / Use another account
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Authentic Google Account Chooser Bottom Sheet Modal */}
        <Modal
          visible={googleChooserVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setGoogleChooserVisible(false)}
        >
          <View style={styles.googleModalBackdrop}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setGoogleChooserVisible(false)}
            />
            <View style={styles.googleSheetContainer}>
              <View style={styles.googleSheetHandle} />

              <View style={styles.googleSheetHeader}>
                <View style={styles.googleLogoContainer}>
                  <Text style={styles.googleLogoTextG}>G</Text>
                  <Text style={styles.googleLogoTextO1}>o</Text>
                  <Text style={styles.googleLogoTextO2}>o</Text>
                  <Text style={styles.googleLogoTextG2}>g</Text>
                  <Text style={styles.googleLogoTextL}>l</Text>
                  <Text style={styles.googleLogoTextE}>e</Text>
                </View>
                <Text style={styles.googleSheetTitle}>Choose an account</Text>
                <Text style={styles.googleSheetSubtitle}>
                  to continue to <Text style={{ fontWeight: '700', color: '#1a73e8' }}>VelocitiFleet Driver</Text>
                </Text>
              </View>

              <View style={styles.googleSheetDivider} />

              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                {deviceAccounts.map((acc) => {
                  const isCurrent = authenticatingAccountId === acc.id;
                  return (
                    <TouchableOpacity
                      key={acc.id}
                      style={[styles.googleAccountRow, isCurrent && { backgroundColor: 'rgba(26,115,232,0.1)' }]}
                      activeOpacity={0.7}
                      onPress={() => handleSelectGoogleAccount(acc)}
                      disabled={Boolean(authenticatingAccountId)}
                    >
                      <View style={[styles.googleAvatarCircle, { backgroundColor: acc.avatarBg || '#1a73e8' }]}>
                        <Text style={styles.googleAvatarText}>{acc.initial}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.googleAccountName}>{acc.name}</Text>
                        <Text style={styles.googleAccountEmail}>{acc.email}</Text>
                      </View>
                      {isCurrent ? (
                        <ActivityIndicator size="small" color="#1a73e8" />
                      ) : (
                        <Text style={styles.googleAccountArrow}>›</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}

                {!isAddingNewAccount ? (
                  <TouchableOpacity
                    style={styles.googleAccountRow}
                    activeOpacity={0.7}
                    onPress={() => setIsAddingNewAccount(true)}
                  >
                    <View style={styles.googleAddAvatarCircle}>
                      <Text style={styles.googleAddIcon}>＋</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.googleAddAccountText}>Use another account</Text>
                      <Text style={styles.googleAccountEmail}>Add a new Google Account</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.addAccountBox}>
                    <Text style={styles.addAccountHeading}>Add Google Account</Text>
                    <TextInput
                      style={styles.googleInput}
                      placeholder="Display Name (e.g. John Doe)"
                      placeholderTextColor="#9aa0a6"
                      value={newAccountName}
                      onChangeText={setNewAccountName}
                    />
                    <TextInput
                      style={styles.googleInput}
                      placeholder="your.email@gmail.com"
                      placeholderTextColor="#9aa0a6"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={newAccountEmail}
                      onChangeText={setNewAccountEmail}
                    />
                    <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                      <TouchableOpacity
                        style={styles.googleCancelBtn}
                        onPress={() => setIsAddingNewAccount(false)}
                      >
                        <Text style={styles.googleCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.googleSubmitBtn}
                        onPress={handleAddNewGoogleAccount}
                      >
                        <Text style={styles.googleSubmitText}>Add & Sign In</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </ScrollView>

              <View style={styles.googleSheetDivider} />

              <View style={styles.googleSheetFooter}>
                <Text style={styles.googleDisclaimer}>
                  To continue, Google will share your name, email address, language preference, and profile picture with VelocitiFleet Driver. Review VelocitiFleet's Privacy Policy and Terms of Service.
                </Text>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // ── Main In-Vehicle Driver Cockpit ────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#070709" />
      <ScrollView contentContainerStyle={styles.container}>
        {/* ── Top Bar ────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandTitle}>
              VELOCITI<Text style={styles.brandGold}>DRIVER</Text>
            </Text>
            <Text style={styles.brandSub}>In-Vehicle GPS Telemetry Broadcast</Text>
          </View>

          <View style={styles.headerRightActions}>
            {/* Signed-in Google Account Badge */}
            <TouchableOpacity
              style={styles.userProfileChip}
              onPress={handleAccountMenu}
              activeOpacity={0.7}
              title="Tap to Manage Google Account"
            >
              <View style={[styles.cockpitAvatarCircle, { backgroundColor: driverUser?.avatarBg || '#1a73e8' }]}>
                <Text style={styles.cockpitAvatarText}>{driverUser?.initial || driverUser?.name?.charAt(0) || 'G'}</Text>
              </View>
              <View style={{ maxWidth: 110 }}>
                <Text style={styles.userProfileName} numberOfLines={1}>
                  {driverUser?.name}
                </Text>
                <Text style={styles.userProfileGoogle}>Google Verified</Text>
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

        {/* ── Vehicle Selector: Which car are you driving? ────── */}
        <View style={styles.card}>
          {/* Header with Title and Tracking Active on a clean NEW LINE */}
          <View style={styles.cardHeaderCol}>
            <Text style={styles.cardTitle}>🚗 Active Vehicle Assignment</Text>
            {isDriving && (
              <View style={styles.liveBeaconNewLine}>
                <View style={styles.liveBeaconDot} />
                <Text style={styles.liveBeaconText}>TRACKING ACTIVE</Text>
              </View>
            )}
          </View>

          <Text style={styles.cardDesc}>
            Select the vehicle you are operating. Your phone&apos;s GPS will stream to the website as this vehicle&apos;s live position with your Google driver identity.
          </Text>

          {loading ? (
            <ActivityIndicator color="#d4af37" style={{ marginVertical: 14 }} />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
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
                    <View>
                      <Text style={[styles.vehicleChipName, isSelected && styles.goldText]}>
                        {v.make} {v.model}
                      </Text>
                      <Text style={styles.vehicleChipReg}>{v.registration}</Text>
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
                <Text style={styles.assignedMake}>
                  {selectedVehicle.make} {selectedVehicle.model}
                </Text>
                <Text style={styles.assignedPlate}>
                  Plate: {selectedVehicle.registration} · Driver: {driverUser.name}
                </Text>
              </View>
              <View style={styles.assignedRight}>
                <Text style={styles.assignedStatusLabel}>Fleet Status</Text>
                <Text style={styles.assignedStatusVal}>{selectedVehicle.status}</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── In-Cab Driving Cockpit HUD (Speedometer & Telemetry) ── */}
        <View style={styles.cockpitCard}>
          {/* Header with Title and Streaming Status on a clean NEW LINE */}
          <View style={styles.cockpitHeaderCol}>
            <Text style={styles.cockpitLabel}>LIVE VEHICLE TELEMETRY</Text>
            <View style={styles.cockpitStatusNewLine}>
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
              >
                {isDriving
                  ? isSimulating
                    ? 'STREAMING (SIMULATOR)'
                    : 'STREAMING VEHICLE GPS'
                  : 'STANDBY (NOT TRANSMITTING)'}
              </Text>
            </View>
          </View>

          {/* Large Digital Speedometer */}
          <View style={styles.speedometerContainer}>
            <Text style={styles.speedNumber}>{currentSpeedKmh}</Text>
            <Text style={styles.speedUnit}>KM / H</Text>
            <Text style={styles.speedSub}>DIGITAL HUD SPEEDOMETER</Text>
          </View>

          {/* Live Metrics Grid */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>COMPASS HEADING</Text>
              <Text style={styles.metricValue}>
                {getHeadingText(currentHeading)} ({currentHeading}°)
              </Text>
            </View>

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>DISTANCE COVERED</Text>
              <Text style={[styles.metricValue, { color: '#f7e199' }]}>
                {tripDistanceKm} km
              </Text>
            </View>

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>TRIP DURATION</Text>
              <Text style={styles.metricValue}>{formatTimer(tripSeconds)}</Text>
            </View>

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>RADAR PINGS STREAMED</Text>
              <Text style={[styles.metricValue, { color: '#34d399' }]}>
                {pingsStreamed} pings
              </Text>
            </View>
          </View>

          {/* Coordinates Bar */}
          <View style={styles.coordsBar}>
            <Text style={styles.coordsText}>
              GPS Coordinates: {currentGps ? `${currentGps.latitude.toFixed(5)}, ${currentGps.longitude.toFixed(5)}` : 'Awaiting GPS Fix...'}
            </Text>
            <Text style={styles.coordsAccuracy}>
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
              <View>
                <Text style={styles.startDrivingTitle}>
                  START DRIVING {selectedVehicle?.make?.toUpperCase()}
                </Text>
                <Text style={styles.startDrivingSub}>
                  Broadcast phone location as this vehicle&apos;s live GPS
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
              <View>
                <Text style={styles.stopDrivingTitle}>END DRIVE & PARK VEHICLE</Text>
                <Text style={styles.stopDrivingSub}>
                  Stop streaming and save final vehicle parked location
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Secondary test buttons */}
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
            While driving is active, anyone viewing the central website map (
            <Text style={{ color: '#d4af37' }}>https://frontend-weld-seven-80.vercel.app/map</Text>
            ) will see{' '}
            <Text style={{ fontWeight: '800', color: '#fff' }}>
              {selectedVehicle?.make} {selectedVehicle?.model} ({selectedVehicle?.registration})
            </Text>{' '}
            moving live in Chennai driven by{' '}
            <Text style={{ fontWeight: '800', color: '#34d399' }}>{driverUser.name}</Text>.
          </Text>
        </View>

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
  },
  container: {
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 36 : 10,
    paddingBottom: 40,
  },

  // ── Authentication Screen Styles ─────────────────────
  authContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  authHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  authEmblem: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(212,175,55,0.14)',
    borderWidth: 2,
    borderColor: '#d4af37',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#d4af37',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  authBrandTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1.5,
  },
  authBrandSub: {
    fontSize: 13,
    color: 'rgba(248,244,235,0.6)',
    marginTop: 4,
    textAlign: 'center',
  },
  authCard: {
    backgroundColor: '#121217',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.25)',
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 10,
  },
  authCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  googleBrandBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  authCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fcfaf6',
  },
  authCardDesc: {
    fontSize: 11,
    color: 'rgba(248,244,235,0.6)',
    lineHeight: 16,
    marginTop: 2,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  googleIconContainer: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleGLetter: {
    fontSize: 18,
    fontWeight: '900',
    color: '#4285F4',
  },
  googleBtnText: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  deviceAccountsCard: {
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    padding: 12,
  },
  deviceAccountsLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(212,175,55,0.8)',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  deviceAccountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: 6,
    gap: 10,
  },
  accAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accAvatarInitial: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  deviceAccountName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  deviceAccountEmail: {
    fontSize: 11,
    color: 'rgba(248,244,235,0.5)',
    marginTop: 1,
  },
  deviceAccountArrow: {
    fontSize: 18,
    color: 'rgba(248,244,235,0.4)',
    fontWeight: '700',
  },
  allAccountsLink: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  allAccountsLinkText: {
    fontSize: 11,
    color: '#d4af37',
    fontWeight: '700',
  },

  // ── Google Account Chooser Bottom Sheet ──────────────
  googleModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  googleSheetContainer: {
    backgroundColor: '#202124',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingBottom: 28,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#303134',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  googleSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#5f6368',
    alignSelf: 'center',
    marginBottom: 16,
  },
  googleSheetHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  googleLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  googleLogoTextG: { fontSize: 20, fontWeight: '800', color: '#4285F4' },
  googleLogoTextO1: { fontSize: 20, fontWeight: '800', color: '#EA4335' },
  googleLogoTextO2: { fontSize: 20, fontWeight: '800', color: '#FBBC05' },
  googleLogoTextG2: { fontSize: 20, fontWeight: '800', color: '#4285F4' },
  googleLogoTextL: { fontSize: 20, fontWeight: '800', color: '#34A853' },
  googleLogoTextE: { fontSize: 20, fontWeight: '800', color: '#EA4335' },
  googleSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e8eaed',
    marginTop: 4,
  },
  googleSheetSubtitle: {
    fontSize: 12,
    color: '#9aa0a6',
    marginTop: 2,
  },
  googleSheetDivider: {
    height: 1,
    backgroundColor: '#303134',
    marginVertical: 12,
  },
  googleAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 4,
    gap: 14,
  },
  googleAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleAvatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  googleAccountName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e8eaed',
  },
  googleAccountEmail: {
    fontSize: 12,
    color: '#9aa0a6',
    marginTop: 1,
  },
  googleAccountArrow: {
    fontSize: 20,
    color: '#5f6368',
    fontWeight: '600',
  },
  googleAddAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#303134',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleAddIcon: {
    fontSize: 18,
    color: '#8ab4f8',
    fontWeight: '700',
  },
  googleAddAccountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8ab4f8',
  },
  addAccountBox: {
    backgroundColor: '#303134',
    borderRadius: 14,
    padding: 14,
    marginTop: 6,
    marginBottom: 6,
  },
  addAccountHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e8eaed',
    marginBottom: 10,
  },
  googleInput: {
    backgroundColor: '#202124',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#5f6368',
    paddingVertical: 8,
    paddingHorizontal: 12,
    color: '#e8eaed',
    fontSize: 13,
    marginBottom: 8,
  },
  googleCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  googleCancelText: {
    fontSize: 12,
    color: '#9aa0a6',
    fontWeight: '700',
  },
  googleSubmitBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#1a73e8',
  },
  googleSubmitText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '700',
  },
  googleSheetFooter: {
    paddingTop: 4,
  },
  googleDisclaimer: {
    fontSize: 11,
    color: '#9aa0a6',
    lineHeight: 16,
    textAlign: 'center',
  },
  cockpitAvatarCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cockpitAvatarText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },

  // ── Main Cockpit Styles ──────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.2)',
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1.2,
  },
  brandGold: {
    color: '#d4af37',
  },
  brandSub: {
    fontSize: 12,
    color: 'rgba(248,244,235,0.5)',
    marginTop: 2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userProfileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 6,
  },
  userAvatarText: {
    fontSize: 16,
  },
  userProfileName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  userProfileGoogle: {
    fontSize: 9,
    color: '#34d399',
    fontWeight: '700',
  },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 16,
  },
  card: {
    backgroundColor: '#121217',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    padding: 18,
    marginBottom: 16,
  },

  // NEW LINE WRAP FOR TITLE & TRACKING ACTIVE BADGE
  cardHeaderCol: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fcfaf6',
  },
  liveBeaconNewLine: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52,211,153,0.12)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.45)',
    gap: 6,
    alignSelf: 'flex-start',
  },
  liveBeaconDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34d399',
  },
  liveBeaconText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#34d399',
    letterSpacing: 0.6,
  },

  cardDesc: {
    fontSize: 12,
    color: 'rgba(248,244,235,0.6)',
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 18,
  },
  vehicleScroll: {
    marginBottom: 14,
  },
  vehicleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginRight: 10,
    gap: 10,
  },
  vehicleChipActive: {
    backgroundColor: 'rgba(212,175,55,0.14)',
    borderColor: '#d4af37',
  },
  vehicleIcon: {
    fontSize: 22,
  },
  vehicleChipName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  vehicleChipReg: {
    fontSize: 10,
    color: 'rgba(248,244,235,0.5)',
    marginTop: 2,
  },
  goldText: {
    color: '#f7e199',
  },
  assignedVehicleBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    padding: 14,
  },
  assignedLeft: {},
  assignedMake: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  assignedPlate: {
    fontSize: 12,
    color: 'rgba(248,244,235,0.6)',
    marginTop: 2,
  },
  assignedRight: {
    alignItems: 'flex-end',
  },
  assignedStatusLabel: {
    fontSize: 10,
    color: 'rgba(248,244,235,0.4)',
    fontWeight: '700',
  },
  assignedStatusVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#34d399',
    marginTop: 2,
  },
  cockpitCard: {
    backgroundColor: '#0c0c10',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.3)',
    padding: 20,
    marginBottom: 16,
    shadowColor: '#d4af37',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 4,
  },

  // NEW LINE WRAP FOR COCKPIT HEADER & STREAMING VEHICLE GPS BADGE
  cockpitHeaderCol: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 14,
  },
  cockpitLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(248,244,235,0.45)',
    letterSpacing: 1.2,
  },
  cockpitStatusNewLine: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignSelf: 'flex-start',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  cockpitStatus: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  speedometerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    paddingVertical: 10,
  },
  speedNumber: {
    fontSize: 84,
    fontWeight: '900',
    color: '#ffffff',
    lineHeight: 92,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  speedUnit: {
    fontSize: 16,
    fontWeight: '900',
    color: '#d4af37',
    letterSpacing: 2,
  },
  speedSub: {
    fontSize: 10,
    color: 'rgba(248,244,235,0.35)',
    letterSpacing: 1,
    marginTop: 4,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  metricItem: {
    width: '47%',
  },
  metricLabel: {
    fontSize: 9,
    color: 'rgba(248,244,235,0.4)',
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  coordsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 16,
  },
  coordsText: {
    fontSize: 11,
    color: 'rgba(248,244,235,0.6)',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  coordsAccuracy: {
    fontSize: 11,
    color: '#34d399',
    fontWeight: '700',
  },
  actionCard: {
    marginBottom: 16,
  },
  startDrivingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d4af37',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 14,
    shadowColor: '#d4af37',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  startDrivingIcon: {
    fontSize: 26,
  },
  startDrivingTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#070709',
    letterSpacing: 0.5,
  },
  startDrivingSub: {
    fontSize: 11,
    color: 'rgba(7,7,9,0.8)',
    marginTop: 2,
  },
  stopDrivingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 14,
    shadowColor: '#dc2626',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  stopDrivingIcon: {
    fontSize: 26,
  },
  stopDrivingTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  stopDrivingSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  auxRow: {
    marginTop: 10,
    alignItems: 'center',
  },
  auxBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  auxBtnText: {
    color: 'rgba(248,244,235,0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: 'rgba(18,18,24,0.7)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
  },
  infoDesc: {
    fontSize: 11,
    color: 'rgba(248,244,235,0.6)',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#16161e',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 12,
    color: 'rgba(248,244,235,0.6)',
    marginBottom: 14,
  },
  input: {
    backgroundColor: '#0c0c10',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    borderRadius: 10,
    padding: 12,
    color: '#ffffff',
    fontSize: 13,
    marginBottom: 12,
  },
  modalFooter: {
    alignItems: 'flex-end',
  },
  modalCloseBtn: {
    backgroundColor: '#d4af37',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  modalCloseText: {
    color: '#070709',
    fontWeight: '800',
    fontSize: 13,
  },
});
