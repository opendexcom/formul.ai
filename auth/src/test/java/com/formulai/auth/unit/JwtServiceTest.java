package com.formulai.auth.unit;

import com.formulai.auth.service.JwtService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
public class JwtServiceTest {
    private JwtService jwtService;
    private PublicKey publicKey;


    @BeforeEach
    void setUp() throws Exception {
        // Generate a test key pair
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("RSA");
        keyGen.initialize(2048);
        KeyPair keyPair = keyGen.generateKeyPair();
        PrivateKey privateKey = keyPair.getPrivate();
        publicKey = keyPair.getPublic();

        jwtService = new JwtService(privateKey, 24);
    }


    @Test
    void shouldGenerateValidJwtToken() {
        // given
        String email = "test@example.com";
        String role = "AUTHOR";

        // when
        String token = jwtService.generateToken(email, role);

        // then
        assertNotNull(token);
        assertFalse(token.isEmpty());

        String[] tokenParts = token.split("\\.");
        assertEquals(3, tokenParts.length);
    }

    @Test
    void shouldGenerateTokenWithCorrectClaims() {
        // given
        String email = "test@example.com";
        String role = "AUTHOR";

        // when
        String token = jwtService.generateToken(email, role);

        // then
        Claims claims = Jwts.parser()
                .verifyWith(publicKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        assertEquals(email, claims.getSubject());
        assertEquals(role, claims.get("role"));
        assertNotNull(claims.getIssuedAt());
        assertNotNull(claims.getExpiration());
    }

    @Test
    void shouldGenerateTokenWithCorrectExpiration() {
        // given
        String email = "test@example.com";
        String role = "AUTHOR";
        Instant beforeGeneration = Instant.now();

        // when
        String token = jwtService.generateToken(email, role);

        // then
        Claims claims = Jwts.parser()
                .verifyWith(publicKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        Instant expectedExpiration = beforeGeneration.plus(24, ChronoUnit.HOURS);
        Instant actualExpiration = claims.getExpiration().toInstant();

        assertTrue(actualExpiration.isAfter(expectedExpiration.minus(1, ChronoUnit.MINUTES)));
        assertTrue(actualExpiration.isBefore(expectedExpiration.plus(1, ChronoUnit.MINUTES)));
    }

    @Test
    void shouldThrowExceptionwhenTokenGenerationFails() {
        // given
        JwtService jwtServiceWithNullKey = new JwtService(null, 24);

        // when & then
        RuntimeException exception = assertThrows(RuntimeException.class,
                () -> jwtServiceWithNullKey.generateToken("test@example.com", "AUTHOR"));
        assertEquals("Failed to generate JWT token", exception.getMessage());
    }
}
