package com.velocitifleet.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * VehicleLocation model — maps to the `vehicle_locations` table.
 * Represents a single GPS ping from a vehicle's 4G LTE telemetry module.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VehicleLocation {

    private Long id;
    private Long fleetId;
    private BigDecimal latitude;
    private BigDecimal longitude;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime timestamp;

    private BigDecimal speed;    // km/h
    private Integer heading;     // 0-359 degrees
}
