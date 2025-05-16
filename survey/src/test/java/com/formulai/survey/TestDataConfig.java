package com.formulai.survey;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.charset.StandardCharsets;

@Configuration
public class TestDataConfig {

    @Bean
    public ApplicationRunner loadTestData(JdbcTemplate jdbcTemplate) {
        return args -> {
            var resource = new ClassPathResource("data.sql");
            var sql = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            jdbcTemplate.execute(sql);
            var externalSchema = new ClassPathResource("external_schema.sql");
            var externalSql = new String(externalSchema.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            jdbcTemplate.execute(externalSql);
        };
    }
}
