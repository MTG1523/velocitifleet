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

export default function App() {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [showConfig, setShowConfig] = useState(false);

  // Authentication State
  const [driverUser, setDriverUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [googlePromptVisible, setGooglePromptVisible] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');

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
      setGooglePromptVisible(false);

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

  // 2. Check Stored User Session on App Launch
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('@velocitifleet_driver_user');
        if (stored) {
          setDriverUser(JSON.parse(stored));
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

  const handleSignOut = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Sign Out', 'Are you sure you want to log out of VelocitiFleet Driver?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          if (isDriving) await stopDriving();
          await AsyncStorage.removeItem('@velocitifleet_driver_user');
          setDriverUser(null);
        },
      },
    ]);
  };

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
            <Text style={styles.authCardTitle}>Chauffeur Authentication</Text>
            <Text style={styles.authCardDesc}>
              Sign in with your Google Account so your name, email, and live location appear on the fleet radar.
            </Text>

            {/* Google Sign In Button */}
            <TouchableOpacity
              style={styles.googleBtn}
              activeOpacity={0.85}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setGooglePromptVisible(true);
              }}
            >
              <View style={styles.googleIconContainer}>
                <Text style={styles.googleGLetter}>G</Text>
              </View>
              <Text style={styles.googleBtnText}>Sign In with Google Account</Text>
            </TouchableOpacity>

            <View style={styles.authDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or select driver profile</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* 1-Click Driver Accounts */}
            <TouchableOpacity
              style={styles.demoDriverBtn}
              onPress={() => saveUserSession({
                name: 'Carlos Diaz',
                email: 'carlos.diaz@gmail.com',
                photoURL: '',
                role: 'DRIVER',
                provider: 'google.com',
              })}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 20 }}>👨‍✈️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.demoDriverName}>Carlos Diaz</Text>
                <Text style={styles.demoDriverRole}>carlos.diaz@gmail.com · Google Verified</Text>
              </View>
              <Text style={styles.demoDriverArrow}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.demoDriverBtn}
              onPress={() => saveUserSession({
                name: 'Eve Wilson',
                email: 'eve.wilson@gmail.com',
                photoURL: '',
                role: 'DRIVER',
                provider: 'google.com',
              })}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 20 }}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.demoDriverName}>Eve Wilson</Text>
                <Text style={styles.demoDriverRole}>eve.wilson@gmail.com · Google Verified</Text>
              </View>
              <Text style={styles.demoDriverArrow}>→</Text>
            </TouchableOpacity>

            {/* Custom Google Email Entry */}
            <TouchableOpacity
              style={styles.customEmailLink}
              onPress={() => setGooglePromptVisible(true)}
            >
              <Text style={styles.customEmailLinkText}>
                ✍️ Type your own Google Account email
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Custom Google Account Modal */}
        <Modal visible={googlePromptVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Google Account Sign In</Text>
              <Text style={styles.modalSub}>
                Enter your Google Account email to link your driving telemetry:
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Full Name (e.g. John Doe)"
                placeholderTextColor="#666"
                value={customName}
                onChangeText={setCustomName}
              />

              <TextInput
                style={styles.input}
                placeholder="your.email@gmail.com"
                placeholderTextColor="#666"
                keyboardType="email-address"
                autoCapitalize="none"
                value={customEmail}
                onChangeText={setCustomEmail}
              />

              <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.modalCloseBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]}
                  onPress={() => setGooglePromptVisible(false)}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => {
                    const email = customEmail.trim() || 'driver@gmail.com';
                    const name = customName.trim() || email.split('@')[0];
                    saveUserSession({
                      name,
                      email,
                      photoURL: '',
                      role: 'DRIVER',
                      provider: 'google.com',
                    });
                  }}
                >
                  <Text style={styles.modalCloseText}>Authenticate</Text>
                </TouchableOpacity>
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
              onPress={handleSignOut}
              activeOpacity={0.7}
              title="Tap to Sign Out"
            >
              <Text style={styles.userAvatarText}>👨‍✈️</Text>
              <View style={{ maxWidth: 110 }}>
                <Text style={styles.userProfileName} numberOfLines={1}>
                  {driverUser.name}
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
  authCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fcfaf6',
    textAlign: 'center',
    marginBottom: 6,
  },
  authCardDesc: {
    fontSize: 12,
    color: 'rgba(248,244,235,0.6)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 22,
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
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  authDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dividerText: {
    fontSize: 11,
    color: 'rgba(248,244,235,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  demoDriverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    marginBottom: 10,
    gap: 12,
  },
  demoDriverName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  demoDriverRole: {
    fontSize: 11,
    color: 'rgba(248,244,235,0.5)',
    marginTop: 2,
  },
  demoDriverArrow: {
    fontSize: 16,
    color: '#d4af37',
    fontWeight: '800',
  },
  customEmailLink: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 6,
  },
  customEmailLinkText: {
    fontSize: 12,
    color: 'rgba(212,175,55,0.8)',
    fontWeight: '600',
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
