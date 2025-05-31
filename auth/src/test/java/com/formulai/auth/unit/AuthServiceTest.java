package com.formulai.auth.unit;

import com.formulai.auth.dto.request.LoginRequest;
import com.formulai.auth.dto.response.PublicKeyResponse;
import com.formulai.auth.service.AuthService;
import com.formulai.auth.service.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class AuthServiceTest {
    @Mock
    private JwtService jwtService;
    @InjectMocks
    AuthService authService;
    private LoginRequest loginRequest;

    @BeforeEach
    void setUp() {
        loginRequest = new LoginRequest("user@example.com", "password");
    }

    @Test
    void shouldAuthenticateValidUser() {
        // given
        String expectedToken = "jwt-token";
        when(jwtService.generateToken("user@example.com", "AUTHOR")).thenReturn(expectedToken);

        // when
        String accessToken = authService.authenticate(loginRequest);

        // then
        assertNotNull(accessToken);
        assertEquals(expectedToken, accessToken);
    }

    @Test
    void shouldThrowExceptionForInvalidEmail() {
        // given
        LoginRequest invalidEmailRequest = new LoginRequest("wrong@email.com", "password");

        // when & then
        RuntimeException exception = assertThrows(RuntimeException.class,
                () -> authService.authenticate(invalidEmailRequest));
        assertEquals("Nieprawidłowe dane uwierzytelniające", exception.getMessage());
    }

    @Test
    void shouldThrowExceptionForInvalidPassword() {
        // given
        LoginRequest invalidPasswordRequest = new LoginRequest("user@example.com", "wrongpassword");

        // when & then
        RuntimeException exception = assertThrows(RuntimeException.class,
                () -> authService.authenticate(invalidPasswordRequest));
        assertEquals("Nieprawidłowe dane uwierzytelniające", exception.getMessage());
    }

    @Test
    void shouldGenerateTokenWithCorrectEmailAndRole() {
        // given
        String email = "test@example.com";
        String expectedToken = "generated-token";
        when(jwtService.generateToken(email, "AUTHOR")).thenReturn(expectedToken);

        // when
        String actualToken = authService.generateToken(email);

        // then
        assertEquals(expectedToken, actualToken);
    }

    @Test
    void shouldReturnPublicKeyResponseWithCorrectAlgorithmAndPem() {
        // given
        String expectedPem = "-----BEGIN PUBLIC KEY-----\ntest-key\n-----END PUBLIC KEY-----\n";
        when(jwtService.getPublicKeyAsPEM()).thenReturn(expectedPem);

        // when
        PublicKeyResponse response = authService.getPublicToken();

        // then
        assertNotNull(response);
        assertEquals("RS256", response.alg());
        assertEquals(expectedPem, response.pem());
    }
}
