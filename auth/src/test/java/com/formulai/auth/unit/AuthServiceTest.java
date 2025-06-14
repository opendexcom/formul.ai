package com.formulai.auth.unit;

import com.formulai.auth.dto.request.LoginRequest;
import com.formulai.auth.dto.response.PublicKeyResponse;
import com.formulai.auth.service.AuthService;
import com.formulai.auth.service.JwtService;
import com.formulai.auth.model.User;
import com.formulai.auth.model.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class AuthServiceTest {
    @Mock
    private JwtService jwtService;
    @Mock
    private com.formulai.auth.repository.UserRepository userRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
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
        String email = "user@example.com";
        String password = "password";
        UserRole role = UserRole.builder().id(UUID.randomUUID()).name("AUTHOR").build();
        User user = User.builder()
                .id(UUID.randomUUID())
                .email(email)
                .password("hashed-password")
                .roles(Set.of(role))
                .build();

        when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(password, "hashed-password")).thenReturn(true);
        when(jwtService.generateToken(email, Set.of("AUTHOR"))).thenReturn(expectedToken);

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
        assertEquals("Invalid authentication credentials", exception.getMessage());
    }

    @Test
    void shouldThrowExceptionForInvalidPassword() {
        // given
        LoginRequest invalidPasswordRequest = new LoginRequest("user@example.com", "wrongpassword");

        // when & then
        RuntimeException exception = assertThrows(RuntimeException.class,
                () -> authService.authenticate(invalidPasswordRequest));
        assertEquals("Invalid authentication credentials", exception.getMessage());
    }

    @Test
    void shouldGenerateTokenWithCorrectEmailAndRole() {
        // given
        String email = "test@example.com";
        String expectedToken = "generated-token";
        when(jwtService.generateToken(email, Set.of("AUTHOR"))).thenReturn(expectedToken);

        // when
        String actualToken = authService.generateToken(email, Set.of("AUTHOR"));

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

    @Test
    void shouldAuthenticateUserWithNoRoles() {
        // given
        String email = "noroles@example.com";
        String password = "password";
        User user = User.builder()
                .id(UUID.randomUUID())
                .email(email)
                .password("hashed-password")
                .roles(Set.of()) // no roles
                .build();

        when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(password, "hashed-password")).thenReturn(true);
        when(jwtService.generateToken(email, Set.of())).thenReturn("token-without-roles");

        // when
        LoginRequest req = new LoginRequest(email, password);
        String token = authService.authenticate(req);

        // then
        assertEquals("token-without-roles", token);
    }

    @Test
    void shouldGenerateTokenWithEmptyRoles() {
        // given
        String email = "test@example.com";
        String expectedToken = "token-empty-roles";
        when(jwtService.generateToken(email, Set.of())).thenReturn(expectedToken);

        // when
        String token = authService.generateToken(email, Set.of());

        // then
        assertEquals(expectedToken, token);
    }

    @Test
    void shouldPropagateExceptionWhenGetPublicTokenFails() {
        // given
        when(jwtService.getPublicKeyAsPEM()).thenThrow(new RuntimeException("PEM error"));

        // when & then
        RuntimeException ex = assertThrows(RuntimeException.class, () -> authService.getPublicToken());
        assertEquals("PEM error", ex.getMessage());
    }
}
