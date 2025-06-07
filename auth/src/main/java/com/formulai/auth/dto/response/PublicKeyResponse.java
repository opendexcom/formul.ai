package com.formulai.auth.dto.response;


public record PublicKeyResponse(
        String alg,
        String pem
) {
}
