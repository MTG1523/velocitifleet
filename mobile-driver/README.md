# 📱 VelocitiFleet Driver — In-Vehicle GPS Telemetry Mobile App

A standalone mobile app that turns the **driver's phone into the live GPS tracker for the vehicle they are driving**.

Instead of buying and installing dedicated vehicle GPS hardware boxes, the driver simply launches this app on their phone, selects their vehicle, and taps **"START DRIVING"**. Wherever the driver drives, that is where the vehicle moves live on the central operations radar!

---

## 🏎️ How It Works

1. **Driver Selects Vehicle**:
   - The driver opens the app and selects the vehicle they are operating (e.g. `Tesla Model 3 - VF-001` or `Toyota Corolla - VF-002`).
2. **Phone Becomes the Vehicle's GPS Tracker**:
   - The driver taps **"START DRIVING"** and mounts the phone on their dashboard.
   - The phone's navigation-grade GPS continuously reads:
     - Real-time Latitude & Longitude
     - Digital Speedometer (km/h)
     - Compass Heading (0° - 360°)
   - Every 2 seconds, the phone streams this telemetry directly to the central fleet backend (`POST /api/locations`).
3. **Live Web Radar Updates Instantly**:
   - Central operations watching the Live Radar Map ([`https://frontend-weld-seven-80.vercel.app/map`](https://frontend-weld-seven-80.vercel.app/map)) see that vehicle gliding in real-time through the streets of Chennai!
4. **Parking / End of Shift**:
   - When the driver arrives at their destination, they tap **"END DRIVE & PARK VEHICLE"**.
   - The app saves the vehicle's final parked location and displays trip statistics (distance driven, duration, pings streamed).

---

## 📲 How to Install & Run on Your Phone

### Step 1: Install Expo Go on your Phone (Free)
- **iPhone (iOS)**: [Expo Go on Apple App Store](https://apps.apple.com/app/expo-go/id982107779)
- **Android**: [Expo Go on Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

### Step 2: Start the Mobile Dev Server
From your computer terminal:
```bash
cd mobile-driver
npx expo start
```

### Step 3: Scan the QR Code
- **iPhone**: Open the default Camera app, point it at the QR code in your terminal, and tap the yellow banner.
- **Android**: Open the **Expo Go** app, tap **"Scan QR Code"**, and point it at your terminal screen.

The app will instantly launch on your physical phone with full access to your phone's hardware GPS!

---

## 🧪 Desktop Testing Simulation Mode

If you are sitting at a desk or testing indoors without driving:
1. Open the app.
2. Select any car (e.g., `Tesla Model 3`).
3. Tap **"🧪 Test Drive Simulation (Marina Beach)"**.
4. The app will simulate driving down Marina Beach / Anna Salai in Chennai, streaming live speed and coordinates to the central website.
5. Open [`https://frontend-weld-seven-80.vercel.app/map`](https://frontend-weld-seven-80.vercel.app/map) on your computer to watch the vehicle move live on the radar!
