package com.formulai.auth.unit;

import com.formulai.auth.controller.AuthController;
import com.formulai.auth.dto.request.LoginRequest;
import com.formulai.auth.dto.response.LoginResponse;
import com.formulai.auth.service.AuthService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class AuthControllerTest {
    @Mock
    private AuthService authService;
    @InjectMocks
    private AuthController authController;


    @Test
    void shouldReturnTokenWhenCredentialsAreValid() {
        // given
        LoginRequest request = new LoginRequest("user@example.com", "password");
        String token = "valid.jwt.token";
        when(authService.authenticate(request)).thenReturn(token);

        // when
        ResponseEntity<LoginResponse> response = authController.login(request);

        // then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(token, response.getBody().access_token());
    }

    @Test
    void shouldReturnUnauthorizedWhenCredentialsAreInvalid() {
        // given
        LoginRequest request = new LoginRequest("wrong@example.com", "wrongpass");
        when(authService.authenticate(any(LoginRequest.class))).thenThrow(new RuntimeException("Invalid credentials"));

        // when
        ResponseEntity<LoginResponse> response = authController.login(request);

        // then
        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        assertNull(response.getBody());
    }
}
