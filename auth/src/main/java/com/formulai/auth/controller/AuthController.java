package com.formulai.auth.controller;

import com.formulai.auth.dto.request.LoginRequest;
import com.formulai.auth.dto.response.LoginResponse;
import com.formulai.auth.dto.response.PublicKeyResponse;
import com.formulai.auth.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;


@RestController
@RequestMapping("/v1/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    /**
     * Login endpoint that generates JWT tokens
     *
     * @param loginRequest the login credentials
     * @return JWT token response
     */
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody @Valid LoginRequest loginRequest) {
        try {
            String token = authService.authenticate(loginRequest);

            return ResponseEntity.ok(new LoginResponse(token));
        } catch (RuntimeException e) {
            // Log authentication errors
            return ResponseEntity.status(401).build(); // Unauthorized
        } catch (Exception e) {
            // Log unexpected errors
            return ResponseEntity.status(500).build();
        }
    }

    /**
     * Endpoint to get the public key for JWT verification
     *
     * @return Public key response
     */
    @GetMapping("/public-key")
    public ResponseEntity<PublicKeyResponse> getPublicKey() {
        try {
            return ResponseEntity.ok(authService.getPublicToken());
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }

}
