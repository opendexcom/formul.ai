package com.formulai.survey;

import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.support.DatabaseStartupValidator;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.servers.Server;
import jakarta.persistence.EntityManagerFactory;

import java.util.List;
import java.util.stream.Stream;

import javax.sql.DataSource;

@SpringBootApplication
public class SurveyServiceApplication {

	public static final String DATABASE_STARTUP_VALIDATOR = "databaseStartupValidator";

	public static void main(String[] args) {
		SpringApplication.run(SurveyServiceApplication.class, args);
	}

	@Bean
	public OpenAPI customOpenAPI() {
		return new OpenAPI()
			.info(new Info().title("Survey API").version("1.0"))
			.servers(List.of(new Server().url("http://localhost/api/survey")));
	}

	@Bean(name = DATABASE_STARTUP_VALIDATOR)
    public DatabaseStartupValidator databaseStartupValidator(DataSource dataSource) {
		var dsv = new DatabaseStartupValidator();
		dsv.setDataSource(dataSource);
		dsv.setInterval(3);
		dsv.setTimeout(60);

        return dsv;
    }

	@Bean
	public static BeanFactoryPostProcessor dependsOnPostProcessor() {
		return bf -> {
			String[] jpa = bf.getBeanNamesForType(EntityManagerFactory.class);
			Stream.of(jpa)
					.map(bf::getBeanDefinition)
					.forEach(it -> it.setDependsOn(DATABASE_STARTUP_VALIDATOR));
		};
	}


}
