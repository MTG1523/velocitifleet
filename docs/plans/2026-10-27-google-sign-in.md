# Google Sign-In & Strict Route Protection Implementation Plan

> **For agentic workers:** Implement this plan task-by-task using
> `writing-plans` → `executing-plans` (inline) or `subagent-driven-development`
> (parallel subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Google Sign-In authentication with Firebase Client SDK, sync authenticated users with the database, enforce strict route protection via an AuthGuard that redirects unauthenticated users to `/login`, and display user profile details with sign-out capabilities in the navigation bar.

**Architecture:** A client-side Firebase Auth instance provides Google popup authentication wrapped in a React `AuthContext`. An `AuthGuard` in `layout.tsx` gates all application routes behind authentication, redirecting unauthenticated users to `/login`. Upon successful sign-in, the user's Google profile is synced to the internal database via `/api/users/sync` and integrated with rentals.

**Tech Stack:** Next.js 16 (App Router), React 19, Firebase Auth (Client SDK), TypeScript, CSS variables.

**Spec:** [`docs/specs/2026-10-27-google-sign-in-design.md`](file:///c:/Users/mokaa/.gemini/antigravity-ide/scratch/velocitifleet/docs/specs/2026-10-27-google-sign-in-design.md)

## Global Constraints

- Must work seamlessly whether Firebase live keys are configured or in local development mock fallback mode.
- Strict route protection: unauthenticated users accessing `/`, `/map`, `/fleet`, or `/rentals` are redirected to `/login`.
- Authenticated users attempting to visit `/login` are automatically redirected back to `/`.
- Visual styling must adhere to VelocitiFleet brand tokens: `--bg-primary: #060b18`, `--bg-secondary: #0d1526`, neon accents (`#00d4ff`, `#00ff88`).
- Maintain TypeScript strict type safety without `any` regressions.

## Review Focus

1. Popup blocked or cancelled by user in browser: UI shows friendly notification without crashing.
2. Unconfigured Firebase environment variables: Graceful demo sign-in fallback activates seamlessly.
3. Rapid route transitions between `/login` and protected routes: No redirect loops or hydration flickering.
4. User sync idempotency: Repeated logins with the same Google email return existing user record rather than duplicating records.
5. Session cleanup: Signing out purges user context, closes any open popups/modals, and immediately routes to `/login`.

---

### Task 1: Firebase Auth Client & Fallback Configuration

**Files:**
- Modify: `frontend/lib/firebase-client.ts`

**Interfaces:**
- Produces: `clientAuth: Auth | null`, `googleProvider: GoogleAuthProvider`, `isFirebaseConfigured: boolean`, `getDemoUser: () => AuthUser`

- [ ] **Step 1: Update `frontend/lib/firebase-client.ts`**
  Add imports for `getAuth`, `GoogleAuthProvider`, `Auth` from `firebase/auth`. Check if `process.env.NEXT_PUBLIC_FIREBASE_API_KEY` is present and valid. Export `clientAuth`, `googleProvider`, and helper `isFirebaseAuthConfigured()`.
- [ ] **Step 2: Validate TypeScript compilation**
  Run `npx tsc --noEmit` in `frontend/`.
- [ ] **Step 3: Commit**
  `git add frontend/lib/firebase-client.ts; git commit -m "feat(auth): configure Firebase Auth client and google provider"`

---

### Task 2: User Synchronization API Endpoint

**Files:**
- Create: `frontend/app/api/users/sync/route.ts`
- Modify: `frontend/lib/mock-store.ts` (if needed for user search by email)

**Interfaces:**
- Consumes: `POST /api/users/sync` with `{ email: string, name: string, photoURL?: string }`
- Produces: JSON response `{ id: string, name: string, email: string, role: string, photoURL?: string }`

- [ ] **Step 1: Implement `POST` handler in `frontend/app/api/users/sync/route.ts`**
  Extract `email`, `name`, `photoURL` from request body. Check Firestore / mock-store `users` collection for matching email. If found, return existing record. If not found, insert new user with role `CUSTOMER` and return created record.
- [ ] **Step 2: Verify endpoint via curl / PowerShell Invoke-RestMethod**
  Send a test POST request to `http://localhost:3000/api/users/sync` and verify HTTP 200 with synced user profile.
- [ ] **Step 3: Commit**
  `git add frontend/app/api/users/sync/route.ts frontend/lib/mock-store.ts; git commit -m "feat(api): add user sync route for Google accounts"`

---

### Task 3: Global Auth Context & Hook

**Files:**
- Create: `frontend/contexts/AuthContext.tsx`

**Interfaces:**
- Produces: `AuthProvider`, `useAuth(): { user: AuthUser | null, loading: boolean, signInWithGoogle: () => Promise<void>, logout: () => Promise<void> }`

- [ ] **Step 1: Define `AuthUser` interface and create `AuthContext`**
  Include `uid`, `displayName`, `email`, `photoURL`, `dbId`, `role`.
- [ ] **Step 2: Implement `signInWithGoogle` and `logout`**
  If Firebase Auth is configured, invoke `signInWithPopup(clientAuth, googleProvider)`. If offline/unconfigured, offer instant demo Google profile.
  After login, call `/api/users/sync` to populate `dbId` and `role`.
  Implement `onAuthStateChanged` subscription to maintain persistence.
- [ ] **Step 3: Validate TypeScript compilation**
  Run `npx tsc --noEmit` in `frontend/`.
- [ ] **Step 4: Commit**
  `git add frontend/contexts/AuthContext.tsx; git commit -m "feat(auth): create AuthContext and useAuth hook"`

---

### Task 4: Route Protection Guard

**Files:**
- Create: `frontend/components/AuthGuard.tsx`
- Modify: `frontend/app/layout.tsx`

**Interfaces:**
- Consumes: `useAuth()`, `usePathname()`, `useRouter()`
- Produces: Protected application wrapper

- [ ] **Step 1: Create `frontend/components/AuthGuard.tsx`**
  Listen to `loading` and `user`. If loading, render high-tech loading screen. If `!user` and `pathname !== '/login'`, redirect to `/login`. If `user` and `pathname === '/login'`, redirect to `/`.
- [ ] **Step 2: Wrap application in `frontend/app/layout.tsx`**
  Wrap `<Navbar />` and `<main>` inside `<AuthProvider>` and `<AuthGuard>`.
- [ ] **Step 3: Validate route interception**
  Test navigating to `/map` without auth to verify automatic redirect to `/login`.
- [ ] **Step 4: Commit**
  `git add frontend/components/AuthGuard.tsx frontend/app/layout.tsx; git commit -m "feat(auth): enforce strict route protection via AuthGuard"`

---

### Task 5: Dedicated Login Page with Google Sign-In

**Files:**
- Create: `frontend/app/login/page.tsx`
- Modify: `frontend/app/globals.css` (add login card styles and Google button)

**Interfaces:**
- Consumes: `useAuth().signInWithGoogle`
- Produces: User authentication screen

- [ ] **Step 1: Add login page styles in `frontend/app/globals.css`**
  Include `.login-wrapper`, `.login-card`, `.google-btn`, `.google-icon`, and glow effects.
- [ ] **Step 2: Create `frontend/app/login/page.tsx`**
  Render VelocitiFleet logo, vehicle rental headline, features summary (Live GPS Tracking, Instant Fleet Booking, Telemetry Monitoring), and the **Sign in with Google** button. Handle loading and error states.
- [ ] **Step 3: Verify login button interaction**
  Check appearance and button click triggers Google popup.
- [ ] **Step 4: Commit**
  `git add frontend/app/login/page.tsx frontend/app/globals.css; git commit -m "feat(ui): create dedicated login page with Google button"`

---

### Task 6: Navbar Profile & Session Dropdown

**Files:**
- Modify: `frontend/components/Navbar.tsx`
- Modify: `frontend/app/globals.css` (navbar user avatar & badge styles)

**Interfaces:**
- Consumes: `useAuth().user`, `useAuth().logout`
- Produces: Authenticated user badge and sign-out control

- [ ] **Step 1: Update `frontend/components/Navbar.tsx`**
  Hide navbar navigation links when on `/login`. When logged in, render user avatar image (or initials badge), user name, role pill (`CUSTOMER`), and a "Sign Out" button.
- [ ] **Step 2: Add styles in `frontend/app/globals.css`**
  Add `.user-profile-badge`, `.user-avatar`, `.user-role-tag`, `.btn-logout`.
- [ ] **Step 3: Verify logout interaction**
  Clicking Sign Out cleans session and redirects to `/login`.
- [ ] **Step 4: Commit**
  `git add frontend/components/Navbar.tsx frontend/app/globals.css; git commit -m "feat(nav): add user profile and logout to navbar"`

---

### Task 7: Rentals Integration with Authenticated User

**Files:**
- Modify: `frontend/app/rentals/page.tsx`

**Interfaces:**
- Consumes: `useAuth().user`
- Produces: Pre-bound checkout form with logged-in user

- [ ] **Step 1: Update `frontend/app/rentals/page.tsx`**
  Import `useAuth`. When opening the "New Rental" modal, automatically lock `userId` to the logged in user's `dbId` (or `user.id`). Display the user's name/email as the fixed renter.
- [ ] **Step 2: Run full build and TypeScript validation**
  Run `npm run build` or `npx tsc --noEmit` in `frontend/`.
- [ ] **Step 3: Commit**
  `git add frontend/app/rentals/page.tsx; git commit -m "feat(rentals): bind logged in user to rental checkout"`
