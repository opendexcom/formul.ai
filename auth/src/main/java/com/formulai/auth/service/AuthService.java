package com.formulai.auth.service;

import com.formulai.auth.dto.request.LoginRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final JwtService jwtService;

    public String authenticate(LoginRequest request) {
        if ("user@example.com".equals(request.email()) && "password".equals(request.password())) {
            return generateToken(request.email());
        }
        throw new RuntimeException("Nieprawidłowe dane uwierzytelniające");
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
