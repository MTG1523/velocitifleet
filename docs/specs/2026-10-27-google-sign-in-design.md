# Specification: Google Sign-In & Strict Route Protection

**Date:** 2026-10-27  
**Status:** Approved  
**Author:** Pair Programming Session  

---

## 1. Overview
Introduce Google Sign-In authentication using Firebase Authentication (Client SDK) with strict route protection across VelocitiFleet. Visitors are required to authenticate via Google before accessing the fleet dashboard, live GPS map, rentals, or fleet management pages. Upon authentication, user identity is synced to the internal database as a `CUSTOMER` role if not already present.

---

## 2. Architecture & Data Flow

```
[User Browser] 
      │ 
      ├─► (Unauthenticated) ──► Redirected to /login
      │
      ├─► Clicks "Sign in with Google"
      │         │
      │         ▼
      │   signInWithPopup(clientAuth, googleProvider)
      │         │
      │         ▼ (Google credential resolved)
      ├─► POST /api/users/sync { email, name, avatar }
      │         │
      │         ▼
      │   (Find or create user in Firestore / mock-store with role: CUSTOMER)
      │         │
      │         ▼
      └─► AuthContext updated with User profile & DB ID ──► Redirect to /
```

---

## 3. Detailed Component & API Specifications

### 3.1 Client Auth Module (`frontend/lib/firebase-client.ts`)
- Export `clientAuth = getAuth(getClientApp())`
- Export `googleProvider = new GoogleAuthProvider()`
- Provide fallback simulator when `NEXT_PUBLIC_FIREBASE_API_KEY` is unconfigured, allowing local development and testing to continue without interruption.

### 3.2 Global Auth Context (`frontend/contexts/AuthContext.tsx`)
- Context state:
  - `user`: Authenticated user entity with `uid`, `displayName`, `email`, `photoURL`, `dbId`, and `role`.
  - `loading`: Boolean state, false once initial authentication check completes.
  - `signInWithGoogle()`: Launches Google popup and synchronizes with user database.
  - `logout()`: Clears session and redirects to `/login`.

### 3.3 Route Protection (`frontend/components/AuthGuard.tsx`)
- Wraps application content in `app/layout.tsx`.
- While `loading`: Renders a full-screen branded loading indicator.
- If `!user` and `pathname !== '/login'`: Redirects to `/login`.
- If `user` and `pathname === '/login'`: Redirects to `/`.

### 3.4 User Sync API Route (`frontend/app/api/users/sync/route.ts`)
- **Method:** `POST`
- **Body:** `{ email: string, name: string, photoURL?: string }`
- **Logic:**
  - Queries database for user with matching email.
  - If existing, returns `{ id, name, email, role: user.role }`.
  - If new, creates new user record with role `CUSTOMER`, phone `''`, and returns the newly generated user ID.

### 3.5 Dedicated Login Page (`frontend/app/login/page.tsx`)
- Cyberpunk dark theme matching VelocitiFleet design system (`#060b18` background, neon cyan accents, glassmorphic card).
- Branded header with logo and tagline.
- Prominent Google Sign-In button with official Google logo and loading states.
- Clean error messaging if popup is blocked or dismissed.

### 3.6 Navigation Bar Updates (`frontend/components/Navbar.tsx`)
- When on `/login`: Hides navigation links.
- When logged in: Displays user's Google avatar, display name, role badge (`CUSTOMER`), and a dropdown with a "Sign Out" button.

### 3.7 Rentals Integration (`frontend/app/rentals/page.tsx`)
- Pre-selects the logged-in user as the customer in the checkout form.
- Disables manual user selection for non-admin customers to ensure integrity.

---

## 4. Error Handling & Edge Cases
1. **Missing or Invalid Firebase Config:** Gracefully provides a "Demo Google Account" login option so testing does not break.
2. **Popup Blocked / Closed by User:** Handled with a user-friendly toast message rather than uncaught promise rejections.
3. **Database Sync Network Failure:** Logs error and keeps local session active with fallback ID.

---

## 5. Testing Plan
1. **Unauthenticated Access:** Navigating directly to `http://localhost:3000/`, `/map`, `/fleet`, `/rentals` redirects to `/login`.
2. **Login Flow:** Clicking "Sign in with Google" triggers popup; on success, syncs user and redirects to `/`.
3. **Authenticated State:** Navbar displays user avatar and name; links are accessible.
4. **Logout Flow:** Clicking "Sign Out" destroys session and redirects to `/login`.
