package com.velocitifleet.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.velocitifleet.dao.LocationDAO;
import com.velocitifleet.model.VehicleLocation;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArraySet;

/**
 * LocationWebSocketHandler — receives GPS coordinates and broadcasts to all clients.
 *
 * ── FLOW ────────────────────────────────────────────────────────────────
 *
 *  [Vehicle Simulator / 4G LTE Module]
 *       │  connects to ws://localhost:8080/ws/location
 *       │  sends JSON: {"fleetId":1,"latitude":37.77,"longitude":-122.41,"speed":45.5,"heading":90}
 *       ▼
 *  LocationWebSocketHandler.handleTextMessage()
 *       │  1. Parses the GPS payload
 *       │  2. Persists the location to DB via LocationDAO
 *       │  3. Broadcasts a LOCATION_UPDATE message to ALL connected sessions
 *       ▼
 *  [All connected Next.js browser clients]
 *       │  receive: {"type":"LOCATION_UPDATE","fleetId":1,"latitude":37.77,...}
 *       ▼
 *  [react-leaflet map] moves vehicle marker to new coordinates
 *
 * ── SESSION MANAGEMENT ──────────────────────────────────────────────────
 * Sessions are stored in a CopyOnWriteArraySet which is thread-safe for
 * concurrent reads (most common) and occasional writes (connect/disconnect).
 * ────────────────────────────────────────────────────────────────────────
 */
@Component
public class LocationWebSocketHandler extends TextWebSocketHandler {

    // Thread-safe set of all currently active WebSocket sessions
    private final CopyOnWriteArraySet<WebSocketSession> sessions = new CopyOnWriteArraySet<>();

    private final LocationDAO locationDAO;
    private final ObjectMapper objectMapper;

    public LocationWebSocketHandler(LocationDAO locationDAO) {
        this.locationDAO = locationDAO;
        this.objectMapper = new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }

    // ──────────────────────────────────────────────────────────
    //  SESSION LIFECYCLE
    // ──────────────────────────────────────────────────────────

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        sessions.add(session);
        System.out.printf("[WS] Client connected: %s | Total active: %d%n",
                session.getId(), sessions.size());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        sessions.remove(session);
        System.out.printf("[WS] Client disconnected: %s (%s) | Remaining: %d%n",
                session.getId(), status, sessions.size());
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        System.err.printf("[WS] Transport error on session %s: %s%n",
                session.getId(), exception.getMessage());
        sessions.remove(session);
        if (session.isOpen()) session.close(CloseStatus.SERVER_ERROR);
    }

    // ──────────────────────────────────────────────────────────
    //  MESSAGE HANDLING
    // ──────────────────────────────────────────────────────────

    /**
     * Called when any connected client sends a text message.
     *
     * Expected payload (from simulator / vehicle telemetry):
     * {
     *   "fleetId":   1,
     *   "latitude":  37.774929,
     *   "longitude": -122.419416,
     *   "speed":     45.5,        // optional, km/h
     *   "heading":   90           // optional, degrees 0-359
     * }
     */
    @Override
    @SuppressWarnings("unchecked")
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        System.out.printf("[WS] GPS received from %s: %s%n", session.getId(), payload);

        try {
            Map<String, Object> data = objectMapper.readValue(payload, Map.class);

            // ── Parse ─────────────────────────────────────────
            VehicleLocation location = new VehicleLocation();
            location.setFleetId(Long.valueOf(data.get("fleetId").toString()));
            location.setLatitude(new BigDecimal(data.get("latitude").toString()));
            location.setLongitude(new BigDecimal(data.get("longitude").toString()));

            if (data.get("speed") != null) {
                location.setSpeed(new BigDecimal(data.get("speed").toString()));
            }
            if (data.get("heading") != null) {
                location.setHeading(Integer.valueOf(data.get("heading").toString()));
            }

            // ── Persist to DB ─────────────────────────────────
            locationDAO.save(location);

            // ── Broadcast to all frontend clients ─────────────
            Map<String, Object> broadcast = new LinkedHashMap<>();
            broadcast.put("type",      "LOCATION_UPDATE");
            broadcast.put("fleetId",   location.getFleetId());
            broadcast.put("latitude",  location.getLatitude());
            broadcast.put("longitude", location.getLongitude());
            broadcast.put("speed",     location.getSpeed() != null ? location.getSpeed() : BigDecimal.ZERO);
            broadcast.put("heading",   location.getHeading() != null ? location.getHeading() : 0);
            broadcast.put("timestamp", System.currentTimeMillis());

            String broadcastJson = objectMapper.writeValueAsString(broadcast);
            broadcastToAll(new TextMessage(broadcastJson));

        } catch (Exception e) {
            System.err.printf("[WS] Error processing GPS payload: %s%n", e.getMessage());
            // Optionally send error back to sender
            session.sendMessage(new TextMessage(
                "{\"type\":\"ERROR\",\"message\":\"Invalid GPS payload: " + e.getMessage() + "\"}"
            ));
        }
    }

    // ──────────────────────────────────────────────────────────
    //  BROADCAST
    // ──────────────────────────────────────────────────────────

    /**
     * Sends a message to every active session.
     * Stale (closed) sessions are pruned during iteration.
     */
    private void broadcastToAll(TextMessage message) {
        sessions.removeIf(s -> !s.isOpen()); // prune closed sessions
        sessions.forEach(s -> {
            try {
                synchronized (s) { // synchronize per-session to avoid concurrent write errors
                    s.sendMessage(message);
                }
            } catch (Exception e) {
                System.err.printf("[WS] Failed to send to session %s: %s%n",
                        s.getId(), e.getMessage());
            }
        });
    }

    /** Returns the current number of connected WebSocket clients. */
    public int getConnectedCount() {
        return sessions.size();
    }
}
