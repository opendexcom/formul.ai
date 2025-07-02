package com.formulai.auth.unit;

import com.formulai.auth.service.JwtService;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
public class JwtServiceExtendedTest {

    @Test
    void shouldDetectExpiredToken() throws Exception {
        // given
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("RSA");
        keyGen.initialize(2048);
        KeyPair keyPair = keyGen.generateKeyPair();
        PrivateKey privateKey = keyPair.getPrivate();
        PublicKey publicKey = keyPair.getPublic();

        // Tworzymy usługę z 0-godzinnym okresem ważności tokenu (natychmiast wygasa)
        JwtService jwtService = new JwtService(privateKey, publicKey, 0);

        // when
        String token = jwtService.generateToken("test@example.com", Set.of("ROLE_USER"));

        // then
        assertFalse(jwtService.isTokenValid(token), "Token powinien być nieważny, bo natychmiast wygasa");
    }

    @Test
    void shouldHandleInvalidTokenFormat() throws Exception {
        // given
        KeyPair keyPair = KeyPairGenerator.getInstance("RSA").generateKeyPair();
        JwtService jwtService = new JwtService(keyPair.getPrivate(), keyPair.getPublic(), 24);
        String invalidToken = "invalid.token.format";

        // when & then
        assertFalse(jwtService.isTokenValid(invalidToken));
    }

    @Test
    void shouldHandleTokenWithInvalidSignature() throws Exception {
        // given
        // Wygenerowanie dwóch różnych par kluczy
        KeyPair keyPair1 = KeyPairGenerator.getInstance("RSA").generateKeyPair();
        KeyPair keyPair2 = KeyPairGenerator.getInstance("RSA").generateKeyPair();

        // Generowanie tokenu z pierwszym kluczem
        JwtService jwtService1 = new JwtService(keyPair1.getPrivate(), keyPair1.getPublic(), 24);
        String token = jwtService1.generateToken("test@example.com", Set.of("ROLE_USER"));

        // Weryfikacja tokenu drugim kluczem
        JwtService jwtService2 = new JwtService(keyPair2.getPrivate(), keyPair2.getPublic(), 24);

        // when & then
        assertThrows(JwtException.class, () -> jwtService2.extractEmail(token));
        assertFalse(jwtService2.isTokenValid(token));
    }

    @Test
    void shouldHandleNullToken() throws Exception {
        // given
        KeyPair keyPair = KeyPairGenerator.getInstance("RSA").generateKeyPair();
        JwtService jwtService = new JwtService(keyPair.getPrivate(), keyPair.getPublic(), 24);

        // when & then
        assertFalse(jwtService.isTokenValid(null));
    }

    @Test
    void shouldExtractEmailFromToken() throws Exception {
        // given
        String expectedEmail = "user@example.com";
        KeyPair keyPair = KeyPairGenerator.getInstance("RSA").generateKeyPair();
        JwtService jwtService = new JwtService(keyPair.getPrivate(), keyPair.getPublic(), 24);
        String token = jwtService.generateToken(expectedEmail, Set.of("ROLE_USER"));

        // when
        String extractedEmail = jwtService.extractEmail(token);

        // then
        assertEquals(expectedEmail, extractedEmail);
    }

    @Test
    void shouldSupportTokenWithMultipleRoles() throws Exception {
        // given
        Set<String> expectedRoles = Set.of("ROLE_USER", "ROLE_ADMIN", "ROLE_AUTHOR");
        KeyPair keyPair = KeyPairGenerator.getInstance("RSA").generateKeyPair();
        JwtService jwtService = new JwtService(keyPair.getPrivate(), keyPair.getPublic(), 24);
        String token = jwtService.generateToken("user@example.com", expectedRoles);

        // when
        Set<String> extractedRoles = jwtService.extractRoles(token);

        // then
        assertEquals(expectedRoles.size(), extractedRoles.size());
        assertTrue(extractedRoles.containsAll(expectedRoles));
    }
}
