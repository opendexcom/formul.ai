package com.formulai.auth.service;

import io.jsonwebtoken.Jwts;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.security.PrivateKey;
import java.security.PublicKey;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Date;

@Service
@RequiredArgsConstructor
public class JwtService {
    private final PrivateKey privateKey;
    private final PublicKey publicKey;
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

    /**
     * Converts the public key to PEM format as a String.
     *
     * @return Public key in PEM format
     */
    public String getPublicKeyAsPEM() {
        try {
            byte[] encoded = publicKey.getEncoded();
            String base64Key = Base64.getEncoder().encodeToString(encoded);

            StringBuilder pemBuilder = new StringBuilder();
            pemBuilder.append("-----BEGIN PUBLIC KEY-----\n");

            int lineLength = 64;
            for (int i = 0; i < base64Key.length(); i+=lineLength) {
                int endIndex = Math.min(i + lineLength, base64Key.length());
                pemBuilder.append(base64Key, i, endIndex).append("\n");
            }

            pemBuilder.append("-----END PUBLIC KEY-----\n");
            return pemBuilder.toString();
        } catch (Exception e) {
            throw new RuntimeException("Failed to convert public key to PEM format", e);
        }
    }
}
