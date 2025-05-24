package com.formulai.auth.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank(message = "Email is required")
        @Email(message = "Email is not valid")
        String email,
        @NotBlank(message = "Password is required")
        String password
) {}
