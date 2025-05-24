package com.formulai.auth.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.NoSuchAlgorithmException;
import java.security.PrivateKey;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;

@Configuration
public class JwtConfig {

    @Value("${AUTH_PRIVATE_KEY}")
    private String privateKey;

    @Value("${jwt.expiration-hours:24}")
    private int expirationHours;

    @Bean
    public PrivateKey privateKey() throws NoSuchAlgorithmException, InvalidKeySpecException, IOException {
        String normalizedKey = privateKey.replace("\\n", "\n");

        String privateKeyContent = normalizedKey
                .replaceAll("\\n", "")
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");

        byte[] decoded = Base64.getDecoder().decode(privateKeyContent);
        PKCS8EncodedKeySpec keySpec = new PKCS8EncodedKeySpec(decoded);
        KeyFactory keyFactory = KeyFactory.getInstance("RSA");

        return keyFactory.generatePrivate(keySpec);
    }

    @Bean
    public int jwtExpirationHours() {
        return expirationHours;
    }

}
