
# Survey Service

**Survey Management Microservice** for the `formulAI` platform.  
Built with **Spring Boot 3.4.5**, Java **21**, and Maven.  
Includes **OpenAPI UI** support via SpringDoc.

---

## 🧱 Tech Stack

- Spring Boot Starter
- Spring Boot Test
- SpringDoc OpenAPI
- Flyway (Database Migrations)

---

## ⚙️ Requirements

- Java 21 (JDK)
- Maven 3.8+
- (Optional) Docker (for future deployment)

---

## 🚀 Getting Started

### Running the Application
Using Docker (on root repository folder)

```bash
docker compose up --build survey
```

Using Maven Wrapper:

```bash
./mvnw spring-boot:run
```

Or with system Maven:

```bash
mvn spring-boot:run
```

### Build and Run as a JAR

```bash
mvn clean package
java -jar target/survey-service-0.0.1-SNAPSHOT.jar
```

---

## 🗄️ Database Migrations

This project uses **Flyway** for database schema migrations.

Migrations are now automatically executed. No need to manual run.

### Adding New Migrations
- Place SQL files in:  
  `src/main/resources/db/migration/`
- Use this naming pattern:  
  `V<version>__<description>.sql`  
  Example: `V3__add_survey_table.sql`

---

## ✅ Running Tests

```bash
mvn test
mvn verify
```

Expected Output:

```text
BUILD SUCCESS
```

If not — fix it. No excuses.

---

## 📖 API Documentation

Access Swagger UI at:

```
http://localhost/swagger
```

---

## 📦 Maven Coordinates

- **Group ID:** `com.formulai`
- **Artifact ID:** `survey-service`
- **Version:** `0.0.1-SNAPSHOT`
