package com.velocitifleet.controller;

import com.velocitifleet.dao.FleetDAO;
import com.velocitifleet.model.Fleet;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * FleetController — REST endpoints for fleet vehicle management.
 *
 * Base path: /api/fleet
 */
@RestController
@RequestMapping("/api/fleet")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001"})
public class FleetController {

    private final FleetDAO fleetDAO;

    public FleetController(FleetDAO fleetDAO) {
        this.fleetDAO = fleetDAO;
    }

    /** GET /api/fleet — all vehicles */
    @GetMapping
    public ResponseEntity<List<Fleet>> getAllVehicles() {
        return ResponseEntity.ok(fleetDAO.findAll());
    }

    /** GET /api/fleet/available — only AVAILABLE vehicles */
    @GetMapping("/available")
    public ResponseEntity<List<Fleet>> getAvailableVehicles() {
        return ResponseEntity.ok(fleetDAO.findByStatus("AVAILABLE"));
    }

    /** GET /api/fleet/status/{status} — vehicles by status */
    @GetMapping("/status/{status}")
    public ResponseEntity<List<Fleet>> getByStatus(@PathVariable String status) {
        return ResponseEntity.ok(fleetDAO.findByStatus(status.toUpperCase()));
    }

    /** GET /api/fleet/{id} — single vehicle by id */
    @GetMapping("/{id}")
    public ResponseEntity<Fleet> getById(@PathVariable Long id) {
        return fleetDAO.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** POST /api/fleet — add a new vehicle */
    @PostMapping
    public ResponseEntity<Fleet> addVehicle(@RequestBody Fleet fleet) {
        Fleet saved = fleetDAO.save(fleet);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    /**
     * PATCH /api/fleet/{id}/status?status=MAINTENANCE
     * Update just the status field (e.g., toggle maintenance).
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<Void> updateStatus(
            @PathVariable Long id,
            @RequestParam String status) {

        boolean updated = fleetDAO.updateStatus(id, status.toUpperCase());
        return updated
                ? ResponseEntity.ok().build()
                : ResponseEntity.notFound().build();
    }

    /** DELETE /api/fleet/{id} — remove a vehicle */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteVehicle(@PathVariable Long id) {
        boolean deleted = fleetDAO.delete(id);
        return deleted
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }
}
