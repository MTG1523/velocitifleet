package com.velocitifleet.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Rental model — maps to the `rentals` table.
 * status: ACTIVE | COMPLETED | CANCELLED
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Rental {

    private Long id;
    private Long userId;
    private Long fleetId;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime startTime;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime endTime;

    private String status;       // ACTIVE, COMPLETED, CANCELLED
    private BigDecimal totalCost;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;
}
