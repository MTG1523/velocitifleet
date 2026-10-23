package com.velocitifleet.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Fleet model — maps to the `fleet` table.
 *
 * type:   Car | Scooter | Truck | Van | Motorcycle
 * status: AVAILABLE | RENTED | MAINTENANCE
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Fleet {

    private Long id;
    private String make;
    private String model;
    private String type;           // Car, Scooter, Truck, Van, Motorcycle
    private String registration;   // e.g. VF-001
    private String status;         // AVAILABLE, RENTED, MAINTENANCE
    private Integer year;
    private BigDecimal dailyRate;
    private String imageUrl;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;
}
