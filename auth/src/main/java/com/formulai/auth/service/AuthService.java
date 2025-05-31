package com.formulai.auth.service;

import com.formulai.auth.dto.request.LoginRequest;
import com.formulai.auth.dto.response.PublicKeyResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final JwtService jwtService;

    /**
     * Authenticates the user based on email and password.
     * In a real application, this should check against a user database.
     *
     * @param request the login request containing email and password
     * @return JWT token if authentication is successful
     */
    public String authenticate(LoginRequest request) {
        if ("user@example.com".equals(request.email()) && "password".equals(request.password())) {
            return generateToken(request.email());
        }
        throw new RuntimeException("Nieprawidłowe dane uwierzytelniające");
    }

    /**
     * Retrieves the public key used for JWT verification.
     *
     * @return PublicKeyResponse containing the public key in PEM format
     */
    public PublicKeyResponse getPublicToken() {
        return new PublicKeyResponse("RS256", jwtService.getPublicKeyAsPEM());
    }

    /**
     * Generates a JWT token for the given user email with default role
     *
     * @param email the user's email
     * @return JWT token string
     */
    public String generateToken(String email) {
        return jwtService.generateToken(email, "AUTHOR");
    }
}
