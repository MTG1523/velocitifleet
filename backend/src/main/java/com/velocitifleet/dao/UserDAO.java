package com.velocitifleet.dao;

import com.velocitifleet.model.User;
import org.springframework.stereotype.Repository;

import javax.sql.DataSource;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * UserDAO — raw JDBC DAO for the `users` table.
 *
 * All queries use PreparedStatement to prevent SQL injection.
 * Connections are obtained from the HikariCP pool and closed
 * with try-with-resources to prevent connection leaks.
 */
@Repository
public class UserDAO {

    private final DataSource dataSource;

    public UserDAO(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    // ──────────────────────────────────────────────────────────
    //  READ
    // ──────────────────────────────────────────────────────────

    /** Returns all users ordered by most recent first. */
    public List<User> findAll() {
        final String sql = "SELECT * FROM users ORDER BY created_at DESC";
        List<User> users = new ArrayList<>();

        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {

            while (rs.next()) {
                users.add(mapRow(rs));
            }
        } catch (SQLException e) {
            throw new RuntimeException("Error fetching all users", e);
        }
        return users;
    }

    /** Finds a user by primary key. Returns empty Optional if not found. */
    public Optional<User> findById(Long id) {
        final String sql = "SELECT * FROM users WHERE id = ?";

        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {

            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapRow(rs));
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Error fetching user with id=" + id, e);
        }
        return Optional.empty();
    }

    // ──────────────────────────────────────────────────────────
    //  WRITE
    // ──────────────────────────────────────────────────────────

    /**
     * Inserts a new user and returns the entity with generated id and created_at.
     * Uses RETURNING clause (PostgreSQL).
     * MySQL alternative: use Statement.RETURN_GENERATED_KEYS then SELECT created_at.
     */
    public User save(User user) {
        final String sql =
            "INSERT INTO users (name, phone, email, role) " +
            "VALUES (?, ?, ?, ?) " +
            "RETURNING id, created_at";

        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {

            ps.setString(1, user.getName());
            ps.setString(2, user.getPhone());
            ps.setString(3, user.getEmail());
            ps.setString(4, user.getRole() != null ? user.getRole() : "CUSTOMER");

            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    user.setId(rs.getLong("id"));
                    user.setCreatedAt(rs.getTimestamp("created_at").toLocalDateTime());
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Error saving user: " + user.getEmail(), e);
        }
        return user;
    }

    // ──────────────────────────────────────────────────────────
    //  MAPPING
    // ──────────────────────────────────────────────────────────

    /** Maps a ResultSet row to a User object. */
    private User mapRow(ResultSet rs) throws SQLException {
        User user = new User();
        user.setId(rs.getLong("id"));
        user.setName(rs.getString("name"));
        user.setPhone(rs.getString("phone"));
        user.setEmail(rs.getString("email"));
        user.setRole(rs.getString("role"));
        Timestamp createdAt = rs.getTimestamp("created_at");
        if (createdAt != null) {
            user.setCreatedAt(createdAt.toLocalDateTime());
        }
        return user;
    }
}
