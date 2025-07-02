package com.formulai.auth.service;

import com.formulai.auth.dto.request.LoginRequest;
import com.formulai.auth.dto.response.PublicKeyResponse;
import com.formulai.auth.model.User;
import com.formulai.auth.repository.UserRepository;
import com.formulai.auth.util.RoleUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Set;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * Authenticates the user based on email and password.
     * Checks against a user database.
     *
     * @param request the login request containing email and password
     * @return JWT token if authentication is successful
     */
    public String authenticate(LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new RuntimeException("Invalid authentication credentials"));

        if (passwordEncoder.matches(request.password(), user.getPassword())) {
            Set<String> roleNames = RoleUtils.extractRoleNames(user.getRoles());
            return generateToken(user.getEmail(), roleNames);
        }
        throw new RuntimeException("Invalid authentication credentials");
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
    public String generateToken(String email, java.util.Set<String> roles) {
        return jwtService.generateToken(email, roles);
    }
}
