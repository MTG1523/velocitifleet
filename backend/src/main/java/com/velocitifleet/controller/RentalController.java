package com.velocitifleet.controller;

import com.velocitifleet.dao.RentalDAO;
import com.velocitifleet.model.Rental;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * RentalController — REST endpoints for rental lifecycle management.
 *
 * Base path: /api/rentals
 *
 * Key endpoints:
 *   POST /checkout  — initiates a rental (transactional: creates record + marks vehicle RENTED)
 *   POST /{id}/complete — ends a rental (transactional: closes record + marks vehicle AVAILABLE)
 */
@RestController
@RequestMapping("/api/rentals")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001"})
public class RentalController {

    private final RentalDAO rentalDAO;

    public RentalController(RentalDAO rentalDAO) {
        this.rentalDAO = rentalDAO;
    }

    /** GET /api/rentals — all rentals */
    @GetMapping
    public ResponseEntity<List<Rental>> getAllRentals() {
        return ResponseEntity.ok(rentalDAO.findAll());
    }

    /** GET /api/rentals/{id} — single rental by id */
    @GetMapping("/{id}")
    public ResponseEntity<Rental> getRentalById(@PathVariable Long id) {
        return rentalDAO.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** GET /api/rentals/user/{userId} — all rentals for a user */
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<Rental>> getRentalsByUser(@PathVariable Long userId) {
        return ResponseEntity.ok(rentalDAO.findByUserId(userId));
    }

    /**
     * POST /api/rentals/checkout
     * Body: { "userId": 2, "fleetId": 1 }
     *
     * Initiates a rental in a single JDBC transaction:
     *   1. Locks the vehicle (status must be AVAILABLE)
     *   2. Creates the rental record
     *
     * Returns 409 CONFLICT if the vehicle is not available.
     */
    @PostMapping("/checkout")
    public ResponseEntity<?> checkout(@RequestBody Map<String, Long> body) {
        try {
            Rental rental = new Rental();
            rental.setUserId(body.get("userId"));
            rental.setFleetId(body.get("fleetId"));
            Rental created = rentalDAO.checkout(rental);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * POST /api/rentals/{id}/complete
     * Completes a rental in a single JDBC transaction:
     *   1. Closes the rental record and calculates cost
     *   2. Marks the vehicle AVAILABLE
     *
     * Returns 404 if rental not found or already completed.
     */
    @PostMapping("/{id}/complete")
    public ResponseEntity<?> completeRental(@PathVariable Long id) {
        try {
            Rental completed = rentalDAO.completeRental(id);
            return ResponseEntity.ok(completed);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        }
    }
}
