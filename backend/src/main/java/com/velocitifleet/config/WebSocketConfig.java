package com.velocitifleet.config;

import com.velocitifleet.websocket.LocationWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * WebSocketConfig — registers the LocationWebSocketHandler at /ws/location.
 *
 * Both the vehicle simulator and the browser frontend connect to this endpoint.
 * setAllowedOrigins("*") is permissive for development. In production,
 * restrict to your actual domain.
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final LocationWebSocketHandler locationWebSocketHandler;

    public WebSocketConfig(LocationWebSocketHandler locationWebSocketHandler) {
        this.locationWebSocketHandler = locationWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry
            .addHandler(locationWebSocketHandler, "/ws/location")
            .setAllowedOrigins("*"); // Allow Next.js dev server + simulator
    }
}
