package com.formulai.auth.service;

import io.jsonwebtoken.Jwts;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.security.PrivateKey;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

@Service
@RequiredArgsConstructor
public class JwtService {
    private final PrivateKey privateKey;
    private final int jwtExpirationHours;

    /**
     * Generates a JWT token for the given user email
     *
     * @param email the user's email
     * @return JWT token string
     */
    public String generateToken(String email, String role) {
        try {
            Instant now = Instant.now();
            Instant expiration = now.plus(jwtExpirationHours, ChronoUnit.HOURS);

            return Jwts.builder()
                    .subject(email)
                    .claim("role", role)
                    .issuedAt(Date.from(now))
                    .expiration(Date.from(expiration))
                    .signWith(privateKey)
                    .compact();
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate JWT token", e);
        }
    }
}
