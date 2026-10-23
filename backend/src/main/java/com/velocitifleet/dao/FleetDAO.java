package com.velocitifleet.dao;

import com.velocitifleet.model.Fleet;
import org.springframework.stereotype.Repository;

import javax.sql.DataSource;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * FleetDAO — raw JDBC DAO for the `fleet` table.
 *
 * All queries use PreparedStatement to prevent SQL injection.
 * Connections are borrowed from HikariCP and closed automatically
 * via try-with-resources — no manual conn.close() needed in normal flow.
 */
@Repository
public class FleetDAO {

    private final DataSource dataSource;

    public FleetDAO(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    // ──────────────────────────────────────────────────────────
    //  READ
    // ──────────────────────────────────────────────────────────

    /** Returns all vehicles ordered by newest first. */
    public List<Fleet> findAll() {
        final String sql = "SELECT * FROM fleet ORDER BY created_at DESC";
        List<Fleet> fleets = new ArrayList<>();

        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {

            while (rs.next()) {
                fleets.add(mapRow(rs));
            }
        } catch (SQLException e) {
            throw new RuntimeException("Error fetching all fleet vehicles", e);
        }
        return fleets;
    }

    /**
     * Returns all vehicles with a specific status.
     * @param status one of: AVAILABLE, RENTED, MAINTENANCE
     */
    public List<Fleet> findByStatus(String status) {
        final String sql = "SELECT * FROM fleet WHERE status = ? ORDER BY created_at DESC";
        List<Fleet> fleets = new ArrayList<>();

        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {

            ps.setString(1, status);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    fleets.add(mapRow(rs));
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Error fetching fleet by status=" + status, e);
        }
        return fleets;
    }

    /** Finds a vehicle by primary key. */
    public Optional<Fleet> findById(Long id) {
        final String sql = "SELECT * FROM fleet WHERE id = ?";

        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {

            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapRow(rs));
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Error fetching fleet vehicle with id=" + id, e);
        }
        return Optional.empty();
    }

    // ──────────────────────────────────────────────────────────
    //  WRITE
    // ──────────────────────────────────────────────────────────

    /**
     * Inserts a new fleet vehicle.
     * Returns the entity populated with the DB-generated id and created_at.
     */
    public Fleet save(Fleet fleet) {
        final String sql =
            "INSERT INTO fleet (make, model, type, registration, status, year, daily_rate, image_url) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?) " +
            "RETURNING id, created_at";

        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {

            ps.setString(1, fleet.getMake());
            ps.setString(2, fleet.getModel());
            ps.setString(3, fleet.getType());
            ps.setString(4, fleet.getRegistration());
            ps.setString(5, fleet.getStatus() != null ? fleet.getStatus() : "AVAILABLE");
            ps.setObject(6, fleet.getYear());             // nullable
            ps.setBigDecimal(7, fleet.getDailyRate());
            ps.setString(8, fleet.getImageUrl());         // nullable

            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    fleet.setId(rs.getLong("id"));
                    fleet.setCreatedAt(rs.getTimestamp("created_at").toLocalDateTime());
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Error saving fleet vehicle: " + fleet.getRegistration(), e);
        }
        return fleet;
    }

    /**
     * Updates the status of a vehicle by id.
     * This is called externally only for MAINTENANCE status changes.
     * AVAILABLE ↔ RENTED transitions are managed transactionally in RentalDAO.
     *
     * @return true if a row was updated, false if id not found
     */
    public boolean updateStatus(Long id, String status) {
        final String sql = "UPDATE fleet SET status = ? WHERE id = ?";

        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {

            ps.setString(1, status);
            ps.setLong(2, id);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new RuntimeException("Error updating status for fleet id=" + id, e);
        }
    }

    /**
     * Updates fleet status within an existing, caller-managed connection.
     * Used by RentalDAO for transactional checkout/return operations.
     * The caller is responsible for commit/rollback.
     */
    public int updateStatusWithConnection(Connection conn, Long id, String status) throws SQLException {
        final String sql = "UPDATE fleet SET status = ? WHERE id = ? AND status != ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, status);
            ps.setLong(2, id);
            // Guard: don't re-rent an already-rented vehicle
            ps.setString(3, status);
            return ps.executeUpdate();
        }
    }

    /** Deletes a vehicle by id. Returns true if a row was deleted. */
    public boolean delete(Long id) {
        final String sql = "DELETE FROM fleet WHERE id = ?";

        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {

            ps.setLong(1, id);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new RuntimeException("Error deleting fleet vehicle with id=" + id, e);
        }
    }

    // ──────────────────────────────────────────────────────────
    //  MAPPING
    // ──────────────────────────────────────────────────────────

    /** Maps one ResultSet row to a Fleet instance. */
    private Fleet mapRow(ResultSet rs) throws SQLException {
        Fleet fleet = new Fleet();
        fleet.setId(rs.getLong("id"));
        fleet.setMake(rs.getString("make"));
        fleet.setModel(rs.getString("model"));
        fleet.setType(rs.getString("type"));
        fleet.setRegistration(rs.getString("registration"));
        fleet.setStatus(rs.getString("status"));
        fleet.setYear(rs.getObject("year", Integer.class));
        fleet.setDailyRate(rs.getBigDecimal("daily_rate"));
        fleet.setImageUrl(rs.getString("image_url"));
        Timestamp createdAt = rs.getTimestamp("created_at");
        if (createdAt != null) fleet.setCreatedAt(createdAt.toLocalDateTime());
        return fleet;
    }
}
