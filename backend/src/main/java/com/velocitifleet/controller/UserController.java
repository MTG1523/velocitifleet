package com.velocitifleet.controller;

import com.velocitifleet.dao.UserDAO;
import com.velocitifleet.model.User;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * UserController — REST endpoints for user management.
 * Base path: /api/users
 */
@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001"})
public class UserController {

    private final UserDAO userDAO;

    public UserController(UserDAO userDAO) {
        this.userDAO = userDAO;
    }

    /** GET /api/users — list all users */
    @GetMapping
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(userDAO.findAll());
    }

    /** GET /api/users/{id} — find a user by id */
    @GetMapping("/{id}")
    public ResponseEntity<User> getUserById(@PathVariable Long id) {
        return userDAO.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * POST /api/users — register a new user
     * Body: { "name": "John Doe", "phone": "+1-555-9999", "email": "john@example.com", "role": "CUSTOMER" }
     */
    @PostMapping
    public ResponseEntity<User> registerUser(@RequestBody User user) {
        User saved = userDAO.save(user);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }
}
