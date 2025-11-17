package com.formulai.survey.config;

import org.testcontainers.containers.PostgreSQLContainer;

public class SharedPostgresContainer extends PostgreSQLContainer<SharedPostgresContainer> {

    private static final String IMAGE_VERSION = "postgres:17-alpine";
    private static SharedPostgresContainer container;

    private SharedPostgresContainer() {
        super(IMAGE_VERSION);
        withDatabaseName("testdb");
        withUsername("testuser");
        withPassword("testpass");
    }

    public static SharedPostgresContainer getInstance() {
        if (container == null) {
            container = new SharedPostgresContainer();
            container.start();
        }
        return container;
    }

    @Override
    public void stop() {
        // don't stop the container between tests
    }
}