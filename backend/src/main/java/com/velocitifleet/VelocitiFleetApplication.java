package com.velocitifleet;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * VelocitiFleet — Vehicle Rental & Fleet Management Platform
 *
 * Architecture: Spring Boot REST API + Raw JDBC (DAO pattern) + WebSockets
 * Database:     PostgreSQL via HikariCP connection pool
 * Frontend:     Next.js (separate process on port 3000)
 */
@SpringBootApplication
public class VelocitiFleetApplication {

    public static void main(String[] args) {
        SpringApplication.run(VelocitiFleetApplication.class, args);
    }
}
