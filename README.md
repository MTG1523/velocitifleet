# VelocitiFleet 🚗⚡
**Vehicle Rental & Fleet Management Platform with Live GPS Tracking**

A full-stack semester project built with Spring Boot (raw JDBC), Next.js, WebSockets, and Leaflet.js.

---

## 🏗️ Architecture

```
velocitifleet/
├── backend/          # Java 17 + Spring Boot 3.2 (REST + WebSocket)
│   └── src/main/java/com/velocitifleet/
│       ├── config/   # DataSource (HikariCP), CORS, WebSocket
│       ├── model/    # User, Fleet, Rental, VehicleLocation
│       ├── dao/      # Raw JDBC DAOs (no JPA/Hibernate)
│       ├── controller/ # REST @RestControllers
│       └── websocket/  # LocationWebSocketHandler
├── database/
│   └── schema.sql    # PostgreSQL schema + seed data
├── frontend/         # Next.js 14 App Router (TypeScript)
│   ├── app/          # Pages: /, /map, /rentals, /fleet
│   ├── components/   # Navbar, VehicleMap (Leaflet)
│   └── hooks/        # useWebSocket.ts
└── simulator/
    ├── simulate.js       # Single vehicle GPS simulator
    └── simulate-multi.js # Multi-vehicle simultaneous simulation
```

---

## 🗄️ Database Schema

| Table              | Key Columns                                           |
|--------------------|-------------------------------------------------------|
| `users`            | id, name, phone, email, role (CUSTOMER/ADMIN/DRIVER)  |
| `fleet`            | id, make, model, type, registration, status, daily_rate |
| `rentals`          | id, user_id, fleet_id, start_time, end_time, total_cost |
| `vehicle_locations`| id, fleet_id, latitude, longitude, speed, heading     |

---

## 🚀 Quick Start

### 1. Database Setup (PostgreSQL)

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE velocitifleet;"

# Apply the schema + seed data
psql -U postgres -d velocitifleet -f database/schema.sql
```

### 2. Backend

```bash
cd backend

# Edit src/main/resources/application.properties:
# spring.datasource.password=your_actual_password

# Run the Spring Boot server (port 8080)
./mvnw spring-boot:run
# Windows: mvnw.cmd spring-boot:run
```

### 3. Frontend

```bash
cd frontend
npm run dev    # Starts Next.js on http://localhost:3000
```

### 4. GPS Simulator

```bash
cd simulator

# Simulate one vehicle (Vehicle ID 1)
npm start

# Simulate 4 vehicles simultaneously
npm run multi

# Custom vehicle + location
node simulate.js 2 51.5074 -0.1278   # Vehicle 2, London
```

---

## 📡 REST API Reference

### Fleet — `/api/fleet`
| Method | Path                     | Description                |
|--------|--------------------------|----------------------------|
| GET    | `/api/fleet`             | All vehicles               |
| GET    | `/api/fleet/available`   | Only available vehicles    |
| GET    | `/api/fleet/{id}`        | Single vehicle             |
| POST   | `/api/fleet`             | Add vehicle                |
| PATCH  | `/api/fleet/{id}/status` | Update status (`?status=`) |
| DELETE | `/api/fleet/{id}`        | Remove vehicle             |

### Rentals — `/api/rentals`
| Method | Path                        | Description                           |
|--------|-----------------------------|---------------------------------------|
| GET    | `/api/rentals`              | All rentals                           |
| GET    | `/api/rentals/user/{id}`    | Rentals by user                       |
| POST   | `/api/rentals/checkout`     | Start rental (transactional)          |
| POST   | `/api/rentals/{id}/complete`| End rental + calculate cost (transactional) |

### Users — `/api/users`
| Method | Path           | Description      |
|--------|----------------|------------------|
| GET    | `/api/users`   | All users        |
| POST   | `/api/users`   | Register user    |

### Locations — `/api/locations`
| Method | Path                          | Description                    |
|--------|-------------------------------|--------------------------------|
| GET    | `/api/locations`              | Latest position all vehicles   |
| GET    | `/api/locations/{id}/latest`  | Latest position one vehicle    |
| GET    | `/api/locations/{id}/trail`   | GPS trail (`?limit=50`)        |

---

## 🔌 WebSocket Protocol

**Endpoint:** `ws://localhost:8080/ws/location`

**Simulator → Server (GPS ping):**
```json
{
  "fleetId": 1,
  "latitude": 37.774929,
  "longitude": -122.419416,
  "speed": 45.5,
  "heading": 90
}
```

**Server → All Browsers (broadcast):**
```json
{
  "type": "LOCATION_UPDATE",
  "fleetId": 1,
  "latitude": 37.774929,
  "longitude": -122.419416,
  "speed": 45.5,
  "heading": 90,
  "timestamp": 1729693200000
}
```

---

## 🔑 Key Design Decisions

### Raw JDBC + DAO Pattern
All database access uses `java.sql.Connection`, `PreparedStatement`, and `ResultSet` — no JPA or Hibernate. The `DataSourceConfig` provides a HikariCP connection pool; DAOs borrow connections from it and always close them via `try-with-resources`.

### JDBC Transactions (Rental Checkout)
`RentalDAO.checkout()` and `RentalDAO.completeRental()` use `conn.setAutoCommit(false)` to atomically update **two tables** in a single transaction:

```
checkout():       UPDATE fleet (AVAILABLE→RENTED)  +  INSERT rental
completeRental(): UPDATE rental (cost computed)    +  UPDATE fleet (RENTED→AVAILABLE)
```
If either SQL fails, `conn.rollback()` ensures the data stays consistent.

### WebSocket Live Tracking
- Spring `TextWebSocketHandler` at `/ws/location`
- Sessions stored in `CopyOnWriteArraySet` (thread-safe)
- Each GPS ping is: parsed → persisted to DB → broadcast to all browsers
- Next.js frontend uses a `useWebSocket` hook with exponential back-off reconnect

---

## 🛠️ MySQL Alternative

The schema uses PostgreSQL-specific syntax (`BIGSERIAL`, `RETURNING`, `DISTINCT ON`). For MySQL:

1. Replace `BIGSERIAL` → `BIGINT AUTO_INCREMENT`
2. Replace `RETURNING id, created_at` → use `Statement.RETURN_GENERATED_KEYS`
3. Replace `DISTINCT ON (fleet_id)` → use a subquery with `MAX(timestamp)`
4. Change driver in `pom.xml` and `application.properties`
