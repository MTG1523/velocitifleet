package com.velocitifleet.dao;

import com.velocitifleet.model.Rental;
import org.springframework.stereotype.Repository;

import javax.sql.DataSource;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * RentalDAO — raw JDBC DAO for the `rentals` table.
 *
 * ── TRANSACTION DESIGN ──────────────────────────────────────────
 * Both checkout() and completeRental() must update TWO tables atomically:
 *
 *   checkout():       INSERT into rentals  +  UPDATE fleet status → RENTED
 *   completeRental(): UPDATE rentals       +  UPDATE fleet status → AVAILABLE
 *
 * We achieve atomicity by:
 *   1. Obtaining a raw connection from the pool.
 *   2. Calling conn.setAutoCommit(false)   →  BEGIN TRANSACTION
 *   3. Executing both statements on the SAME connection.
 *   4. Calling conn.commit()               →  COMMIT
 *   5. Calling conn.rollback() on any error, then rethrowing.
 *   6. Resetting autoCommit=true and closing the connection in finally{}.
 *
 * This ensures data consistency: if either SQL fails the whole unit is
 * rolled back and the vehicle never ends up in an inconsistent state.
 * ────────────────────────────────────────────────────────────────
 */
@Repository
public class RentalDAO {

    private final DataSource dataSource;

    public RentalDAO(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    // ──────────────────────────────────────────────────────────
    //  READ
    // ──────────────────────────────────────────────────────────

    public List<Rental> findAll() {
        final String sql = "SELECT * FROM rentals ORDER BY created_at DESC";
        List<Rental> rentals = new ArrayList<>();

        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {

            while (rs.next()) rentals.add(mapRow(rs));
        } catch (SQLException e) {
            throw new RuntimeException("Error fetching all rentals", e);
        }
        return rentals;
    }

    public Optional<Rental> findById(Long id) {
        final String sql = "SELECT * FROM rentals WHERE id = ?";

        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {

            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return Optional.of(mapRow(rs));
            }
        } catch (SQLException e) {
            throw new RuntimeException("Error fetching rental id=" + id, e);
        }
        return Optional.empty();
    }

    public List<Rental> findByUserId(Long userId) {
        final String sql = "SELECT * FROM rentals WHERE user_id = ? ORDER BY created_at DESC";
        List<Rental> rentals = new ArrayList<>();

        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {

            ps.setLong(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) rentals.add(mapRow(rs));
            }
        } catch (SQLException e) {
            throw new RuntimeException("Error fetching rentals for user id=" + userId, e);
        }
        return rentals;
    }

    // ──────────────────────────────────────────────────────────
    //  TRANSACTIONAL: CHECKOUT
    // ──────────────────────────────────────────────────────────

    /**
     * Atomically creates a rental record AND marks the vehicle as RENTED.
     *
     * Transaction steps:
     *   1. UPDATE fleet SET status='RENTED' WHERE id=? AND status='AVAILABLE'
     *      → If 0 rows updated, vehicle is not available → rollback + throw.
     *   2. INSERT INTO rentals (user_id, fleet_id, ...) VALUES (...)
     *   3. COMMIT
     *
     * @param rental  pre-populated with userId and fleetId
     * @return        rental entity with DB-generated id, startTime, status
     * @throws RuntimeException if vehicle is not available or SQL fails
     */
    public Rental checkout(Rental rental) {
        final String lockAndUpdateFleet =
            "UPDATE fleet SET status = 'RENTED' WHERE id = ? AND status = 'AVAILABLE'";
        final String insertRental =
            "INSERT INTO rentals (user_id, fleet_id, start_time, status) " +
            "VALUES (?, ?, NOW(), 'ACTIVE') " +
            "RETURNING id, start_time, created_at";

        Connection conn = null;
        try {
            conn = dataSource.getConnection();
            conn.setAutoCommit(false); // ── BEGIN TRANSACTION ──

            // Step 1: Try to lock the vehicle (only works if AVAILABLE)
            try (PreparedStatement ps = conn.prepareStatement(lockAndUpdateFleet)) {
                ps.setLong(1, rental.getFleetId());
                int updated = ps.executeUpdate();
                if (updated == 0) {
                    conn.rollback();
                    throw new RuntimeException(
                        "Vehicle [id=" + rental.getFleetId() + "] is not available for rental."
                    );
                }
            }

            // Step 2: Create the rental record
            try (PreparedStatement ps = conn.prepareStatement(insertRental)) {
                ps.setLong(1, rental.getUserId());
                ps.setLong(2, rental.getFleetId());

                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        rental.setId(rs.getLong("id"));
                        rental.setStartTime(rs.getTimestamp("start_time").toLocalDateTime());
                        rental.setStatus("ACTIVE");
                        rental.setCreatedAt(rs.getTimestamp("created_at").toLocalDateTime());
                    }
                }
            }

            conn.commit(); // ── COMMIT ──
            return rental;

        } catch (SQLException e) {
            if (conn != null) {
                try { conn.rollback(); } catch (SQLException ex) { ex.printStackTrace(); }
            }
            throw new RuntimeException("Checkout transaction failed", e);
        } finally {
            if (conn != null) {
                try {
                    conn.setAutoCommit(true); // restore pool default
                    conn.close();            // return to HikariCP pool
                } catch (SQLException e) {
                    e.printStackTrace();
                }
            }
        }
    }

    // ──────────────────────────────────────────────────────────
    //  TRANSACTIONAL: COMPLETE RENTAL
    // ──────────────────────────────────────────────────────────

    /**
     * Atomically completes a rental AND frees the vehicle back to AVAILABLE.
     *
     * Cost is calculated as:
     *   hours_elapsed × (daily_rate / 24)
     *
     * Transaction steps:
     *   1. UPDATE rentals SET end_time=NOW(), status='COMPLETED', total_cost=...
     *      → If 0 rows updated, rental not found or not ACTIVE → rollback + throw.
     *   2. UPDATE fleet SET status='AVAILABLE' WHERE id = fleet_id
     *   3. COMMIT
     *
     * @param rentalId  the id of the rental to complete
     * @return          the completed Rental entity with end_time and total_cost
     */
    public Rental completeRental(Long rentalId) {
        // Computes duration-based cost inline using a subquery for daily_rate
        final String closeRental =
            "UPDATE rentals r SET " +
            "  end_time   = NOW(), " +
            "  status     = 'COMPLETED', " +
            "  total_cost = ROUND( " +
            "    EXTRACT(EPOCH FROM (NOW() - r.start_time)) / 3600.0 " +
            "    * (SELECT f.daily_rate / 24.0 FROM fleet f WHERE f.id = r.fleet_id), 2" +
            "  ) " +
            "WHERE r.id = ? AND r.status = 'ACTIVE' " +
            "RETURNING r.id, r.user_id, r.fleet_id, r.start_time, r.end_time, r.status, r.total_cost, r.created_at";

        final String freeVehicle =
            "UPDATE fleet SET status = 'AVAILABLE' WHERE id = ?";

        Connection conn = null;
        try {
            conn = dataSource.getConnection();
            conn.setAutoCommit(false); // ── BEGIN TRANSACTION ──

            Rental rental = new Rental();

            // Step 1: Close the rental
            try (PreparedStatement ps = conn.prepareStatement(closeRental)) {
                ps.setLong(1, rentalId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        conn.rollback();
                        throw new RuntimeException(
                            "Rental [id=" + rentalId + "] not found or already completed."
                        );
                    }
                    rental = mapRow(rs);
                }
            }

            // Step 2: Free the vehicle
            try (PreparedStatement ps = conn.prepareStatement(freeVehicle)) {
                ps.setLong(1, rental.getFleetId());
                ps.executeUpdate();
            }

            conn.commit(); // ── COMMIT ──
            return rental;

        } catch (SQLException e) {
            if (conn != null) {
                try { conn.rollback(); } catch (SQLException ex) { ex.printStackTrace(); }
            }
            throw new RuntimeException("Complete-rental transaction failed", e);
        } finally {
            if (conn != null) {
                try {
                    conn.setAutoCommit(true);
                    conn.close();
                } catch (SQLException e) {
                    e.printStackTrace();
                }
            }
        }
    }

    // ──────────────────────────────────────────────────────────
    //  MAPPING
    // ──────────────────────────────────────────────────────────

    private Rental mapRow(ResultSet rs) throws SQLException {
        Rental rental = new Rental();
        rental.setId(rs.getLong("id"));
        rental.setUserId(rs.getLong("user_id"));
        rental.setFleetId(rs.getLong("fleet_id"));
        Timestamp start = rs.getTimestamp("start_time");
        if (start  != null) rental.setStartTime(start.toLocalDateTime());
        Timestamp end = rs.getTimestamp("end_time");
        if (end    != null) rental.setEndTime(end.toLocalDateTime());
        rental.setStatus(rs.getString("status"));
        rental.setTotalCost(rs.getBigDecimal("total_cost"));
        Timestamp created = rs.getTimestamp("created_at");
        if (created != null) rental.setCreatedAt(created.toLocalDateTime());
        return rental;
    }
}
