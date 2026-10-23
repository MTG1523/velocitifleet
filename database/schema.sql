-- =============================================================
-- VelocitiFleet Database Schema
-- Compatible with: PostgreSQL 14+
-- For MySQL 8+: replace BIGSERIAL with BIGINT AUTO_INCREMENT,
--               replace CHECK constraints with ENUM types,
--               replace RETURNING with SELECT LAST_INSERT_ID()
-- =============================================================

-- Drop tables in reverse dependency order (for clean re-init)
DROP TABLE IF EXISTS vehicle_locations;
DROP TABLE IF EXISTS rentals;
DROP TABLE IF EXISTS fleet;
DROP TABLE IF EXISTS users;

-- ─── users ────────────────────────────────────────────────────
CREATE TABLE users (
    id         BIGSERIAL    PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    phone      VARCHAR(20)  UNIQUE NOT NULL,
    email      VARCHAR(150) UNIQUE NOT NULL,
    role       VARCHAR(20)  NOT NULL DEFAULT 'CUSTOMER'
                   CHECK (role IN ('CUSTOMER', 'ADMIN', 'DRIVER')),
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── fleet ────────────────────────────────────────────────────
CREATE TABLE fleet (
    id           BIGSERIAL     PRIMARY KEY,
    make         VARCHAR(50)   NOT NULL,
    model        VARCHAR(50)   NOT NULL,
    type         VARCHAR(20)   NOT NULL
                     CHECK (type IN ('Car', 'Scooter', 'Truck', 'Van', 'Motorcycle')),
    registration VARCHAR(20)   UNIQUE NOT NULL,
    status       VARCHAR(20)   NOT NULL DEFAULT 'AVAILABLE'
                     CHECK (status IN ('AVAILABLE', 'RENTED', 'MAINTENANCE')),
    year         INT,
    daily_rate   DECIMAL(10,2),
    image_url    VARCHAR(255),
    created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── rentals ──────────────────────────────────────────────────
CREATE TABLE rentals (
    id         BIGSERIAL     PRIMARY KEY,
    user_id    BIGINT        NOT NULL REFERENCES users(id)  ON DELETE RESTRICT,
    fleet_id   BIGINT        NOT NULL REFERENCES fleet(id)  ON DELETE RESTRICT,
    start_time TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time   TIMESTAMP,
    status     VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE'
                   CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
    total_cost DECIMAL(10,2),
    created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── vehicle_locations ────────────────────────────────────────
CREATE TABLE vehicle_locations (
    id        BIGSERIAL      PRIMARY KEY,
    fleet_id  BIGINT         NOT NULL REFERENCES fleet(id) ON DELETE CASCADE,
    latitude  DECIMAL(10,8)  NOT NULL,
    longitude DECIMAL(11,8)  NOT NULL,
    timestamp TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    speed     DECIMAL(6,2),
    heading   INT            CHECK (heading BETWEEN 0 AND 359)
);

-- ─── Indexes for performance ───────────────────────────────────
CREATE INDEX idx_fleet_status            ON fleet(status);
CREATE INDEX idx_rentals_user_id         ON rentals(user_id);
CREATE INDEX idx_rentals_fleet_id        ON rentals(fleet_id);
CREATE INDEX idx_rentals_status          ON rentals(status);
CREATE INDEX idx_vehicle_locations_fleet ON vehicle_locations(fleet_id, timestamp DESC);

-- =============================================================
-- Seed Data
-- =============================================================

INSERT INTO users (name, phone, email, role) VALUES
('Alice Johnson',  '+1-555-0101', 'alice@velocitifleet.com',  'ADMIN'),
('Bob Smith',      '+1-555-0102', 'bob@velocitifleet.com',    'CUSTOMER'),
('Carol White',    '+1-555-0103', 'carol@velocitifleet.com',  'CUSTOMER'),
('David Reyes',    '+1-555-0104', 'david@velocitifleet.com',  'DRIVER'),
('Eva Martinez',   '+1-555-0105', 'eva@velocitifleet.com',    'CUSTOMER');

INSERT INTO fleet (make, model, type, registration, status, year, daily_rate) VALUES
('Tesla',   'Model 3',    'Car',        'VF-001', 'AVAILABLE',   2023, 89.99),
('Toyota',  'Corolla',    'Car',        'VF-002', 'AVAILABLE',   2022, 45.00),
('Honda',   'CBR 600',    'Motorcycle', 'VF-003', 'AVAILABLE',   2023, 35.00),
('Vespa',   'GTS 300',    'Scooter',    'VF-004', 'RENTED',      2022, 25.00),
('Ford',    'Transit',    'Van',        'VF-005', 'AVAILABLE',   2021, 75.00),
('BMW',     'i4',         'Car',        'VF-006', 'MAINTENANCE', 2024, 120.00),
('Toyota',  'HiLux',      'Truck',      'VF-007', 'AVAILABLE',   2021, 95.00),
('Yamaha',  'MT-07',      'Motorcycle', 'VF-008', 'AVAILABLE',   2023, 30.00);

INSERT INTO vehicle_locations (fleet_id, latitude, longitude, speed, heading) VALUES
(1,  37.774929, -122.419416, 0.0,  0),
(4,  37.785834, -122.400747, 35.5, 90),
(5,  37.769234, -122.430512, 0.0,  0);
