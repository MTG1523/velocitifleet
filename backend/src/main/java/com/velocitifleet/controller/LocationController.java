package com.velocitifleet.controller;

import com.velocitifleet.dao.LocationDAO;
import com.velocitifleet.model.VehicleLocation;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * LocationController — REST endpoints for querying vehicle GPS data.
 * Base path: /api/locations
 *
 * Note: Live GPS data arrives via WebSocket (/ws/location), not REST.
 *       These endpoints are for historical queries (last known position, trail).
 */
@RestController
@RequestMapping("/api/locations")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001"})
public class LocationController {

    private final LocationDAO locationDAO;

    public LocationController(LocationDAO locationDAO) {
        this.locationDAO = locationDAO;
    }

    /** GET /api/locations — latest known position for ALL vehicles */
    @GetMapping
    public ResponseEntity<List<VehicleLocation>> getAllLatest() {
        return ResponseEntity.ok(locationDAO.findLatestForAllVehicles());
    }

    /** GET /api/locations/{fleetId}/latest — most recent ping for one vehicle */
    @GetMapping("/{fleetId}/latest")
    public ResponseEntity<VehicleLocation> getLatest(@PathVariable Long fleetId) {
        return locationDAO.findLatestByFleetId(fleetId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * GET /api/locations/{fleetId}/trail?limit=50
     * Returns the N most recent GPS pings for a vehicle (breadcrumb trail).
     */
    @GetMapping("/{fleetId}/trail")
    public ResponseEntity<List<VehicleLocation>> getTrail(
            @PathVariable Long fleetId,
            @RequestParam(defaultValue = "50") int limit) {

        return ResponseEntity.ok(locationDAO.findTrailByFleetId(fleetId, limit));
    }
}
