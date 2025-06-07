package com.formulai.auth;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.servers.Server;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.CommandLineRunner;

import com.formulai.auth.model.User;
import com.formulai.auth.model.UserRole;
import com.formulai.auth.repository.UserRepository;
import com.formulai.auth.repository.UserRoleRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.Random;

@SpringBootApplication
public class AuthApplication {
    public static void main(String[] args) {
        SpringApplication.run(AuthApplication.class, args);
    }

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info().title("Auth API").version("1.0"))
                .servers(List.of(new Server().url("http://localhost/api/auth")));
    }

    @Bean
    public CommandLineRunner insertDummyUser(
            UserRepository userRepository,
            UserRoleRepository userRoleRepository,
            PasswordEncoder passwordEncoder
    ) {
        return args -> {
            String email = "test@test.pl";
            if (userRepository.findByEmail(email).isEmpty()) {
                Logger log = LoggerFactory.getLogger(AuthApplication.class);
                String rawPassword = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
                String encodedPassword = passwordEncoder.encode(rawPassword);

                // Ensure at least one role exists
                UserRole role = userRoleRepository.findByName("ADMIN")
                        .orElseGet(() -> userRoleRepository.save(
                                UserRole.builder().id(UUID.randomUUID()).name("AUTHOR").build()
                        ));

                User user = new User();
                user.setId(UUID.randomUUID());
                user.setEmail(email);
                user.setPassword(encodedPassword);
                user.setRoles(Set.of(role));
                userRepository.save(user);

                log.info("Dummy user created: email={}, password={}", email, rawPassword);
            }
        };
    }
}
