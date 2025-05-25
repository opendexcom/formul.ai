package com.formulai.auth.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.security.KeyFactory;
import java.security.NoSuchAlgorithmException;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

@Configuration
public class JwtConfig {

    @Value("${AUTH_PRIVATE_KEY}")
    private String privateKey;

    @Value("${AUTH_PUBLIC_KEY}")
    private String publicKey;

    @Value("${jwt.expiration-hours:24}")
    private int expirationHours;

    @Bean
    public PrivateKey privateKey() throws NoSuchAlgorithmException, InvalidKeySpecException, IOException {

        String privateKeyContent = privateKey
                .replace("\\n", "\n")
                .replaceAll("\n", "")
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");

        byte[] decoded = Base64.getDecoder().decode(privateKeyContent);
        PKCS8EncodedKeySpec keySpec = new PKCS8EncodedKeySpec(decoded);
        KeyFactory keyFactory = KeyFactory.getInstance("RSA");

        return keyFactory.generatePrivate(keySpec);
    }

    @Bean
    public PublicKey publicKey() throws NoSuchAlgorithmException, InvalidKeySpecException, IOException {

        String publicKeyContent = publicKey
                .replace("\\n", "\n")
                .replaceAll("\n", "")
                .replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replaceAll("\\s", "");

        byte[] decoded = Base64.getDecoder().decode(publicKeyContent);
        KeyFactory keyFactory = KeyFactory.getInstance("RSA");
        return keyFactory.generatePublic(new X509EncodedKeySpec(decoded));
    }

    @Bean
    public int jwtExpirationHours() {
        return expirationHours;
    }

}
