package com.velocitifleet.dao;

import com.velocitifleet.model.VehicleLocation;
import org.springframework.stereotype.Repository;

import javax.sql.DataSource;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * LocationDAO — raw JDBC DAO for the `vehicle_locations` table.
 *
 * This DAO is called by the WebSocket handler each time a GPS ping
 * arrives from a vehicle's telemetry module, persisting it to the DB.
 * It is also used to query the most recent known position and the
 * full GPS trail (breadcrumb path) of any vehicle.
 */
@Repository
public class LocationDAO {

    private final DataSource dataSource;

    public LocationDAO(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    // ──────────────────────────────────────────────────────────
    //  WRITE
    // ──────────────────────────────────────────────────────────

    /**
     * Persists a new GPS ping to the database.
     * Called by LocationWebSocketHandler on every received coordinate message.
     *
     * @param location  VehicleLocation with fleetId, lat, lng, speed, heading populated
     * @return          same entity with DB-generated id and timestamp
     */
    public VehicleLocation save(VehicleLocation location) {
        final String sql =
            "INSERT INTO vehicle_locations (fleet_id, latitude, longitude, speed, heading) " +
            "VALUES (?, ?, ?, ?, ?) " +
            "RETURNING id, timestamp";

        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {

            ps.setLong(1, location.getFleetId());
            ps.setBigDecimal(2, location.getLatitude());
            ps.setBigDecimal(3, location.getLongitude());
            ps.setBigDecimal(4, location.getSpeed());          // nullable
            ps.setObject(5, location.getHeading());            // nullable INT

            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    location.setId(rs.getLong("id"));
                    location.setTimestamp(rs.getTimestamp("timestamp").toLocalDateTime());
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException(
                "Error saving location for fleet id=" + location.getFleetId(), e);
        }
        return location;
    }

    // ──────────────────────────────────────────────────────────
    //  READ
    // ──────────────────────────────────────────────────────────

    /**
     * Returns the most recent GPS ping for a vehicle.
     * Used to initialize the map marker position when the frontend first loads.
     */
    public Optional<VehicleLocation> findLatestByFleetId(Long fleetId) {
        final String sql =
            "SELECT * FROM vehicle_locations " +
            "WHERE fleet_id = ? " +
            "ORDER BY timestamp DESC LIMIT 1";

        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {

            ps.setLong(1, fleetId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return Optional.of(mapRow(rs));
            }
        } catch (SQLException e) {
            throw new RuntimeException("Error fetching latest location for fleet id=" + fleetId, e);
        }
        return Optional.empty();
    }

    /**
     * Returns the last N GPS pings for a vehicle (breadcrumb trail).
     * Results are in descending timestamp order (most recent first).
     */
    public List<VehicleLocation> findTrailByFleetId(Long fleetId, int limit) {
        final String sql =
            "SELECT * FROM vehicle_locations " +
            "WHERE fleet_id = ? " +
            "ORDER BY timestamp DESC LIMIT ?";

        List<VehicleLocation> locations = new ArrayList<>();

        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {

            ps.setLong(1, fleetId);
            ps.setInt(2, limit);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) locations.add(mapRow(rs));
            }
        } catch (SQLException e) {
            throw new RuntimeException("Error fetching trail for fleet id=" + fleetId, e);
        }
        return locations;
    }

    /**
     * Returns the latest known position for ALL vehicles.
     * Useful for initializing the map with all vehicle markers.
     */
    public List<VehicleLocation> findLatestForAllVehicles() {
        // DISTINCT ON is PostgreSQL-specific; returns latest row per fleet_id
        final String sql =
            "SELECT DISTINCT ON (fleet_id) * " +
            "FROM vehicle_locations " +
            "ORDER BY fleet_id, timestamp DESC";

        List<VehicleLocation> locations = new ArrayList<>();

        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {

            while (rs.next()) locations.add(mapRow(rs));
        } catch (SQLException e) {
            throw new RuntimeException("Error fetching latest locations for all vehicles", e);
        }
        return locations;
    }

    // ──────────────────────────────────────────────────────────
    //  MAPPING
    // ──────────────────────────────────────────────────────────

    private VehicleLocation mapRow(ResultSet rs) throws SQLException {
        VehicleLocation loc = new VehicleLocation();
        loc.setId(rs.getLong("id"));
        loc.setFleetId(rs.getLong("fleet_id"));
        loc.setLatitude(rs.getBigDecimal("latitude"));
        loc.setLongitude(rs.getBigDecimal("longitude"));
        Timestamp ts = rs.getTimestamp("timestamp");
        if (ts != null) loc.setTimestamp(ts.toLocalDateTime());
        loc.setSpeed(rs.getBigDecimal("speed"));
        loc.setHeading(rs.getObject("heading", Integer.class));
        return loc;
    }
}
