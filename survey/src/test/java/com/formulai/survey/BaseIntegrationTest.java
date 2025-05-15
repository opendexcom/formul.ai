package com.formulai.survey;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.context.annotation.Import;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.formulai.survey.config.SharedPostgresContainer;

@SpringBootTest
@Testcontainers
@Import(TestDataConfig.class)
public abstract class BaseIntegrationTest {

    private static final SharedPostgresContainer postgres = SharedPostgresContainer.getInstance();


    @DynamicPropertySource
    static void configure(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.datasource.driver-class-name", postgres::getDriverClassName);
    }
}
