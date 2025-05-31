# Auth Service

**Authentication & Authorization Microservice** for the `formulAI` platform.
Built with **Spring Boot 3.5.0**, Java **21**, and Maven.
Includes **OpenAPI UI** support via SpringDoc.

---

## 🧱 Tech Stack

- Spring Boot Starter
- Spring Boot Test
- SpringDoc OpenAPI
- JWT (JJWT 0.12.3)
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
docker compose up --build auth
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
java -jar target/auth-service-0.0.1-SNAPSHOT.jar
```

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
- **Artifact ID:** `auth-service`
- **Version:** `0.0.1-SNAPSHOT`

---

## 🔑 JWT Keys

This project uses RSA keys for signing and verifying JWTs. Ensure the following files are present in the `src/main/resources` directory:

- `private.pem`: Private key for signing JWTs.
- `public.pem`: Public key for verifying JWTs.

---

## 🤖 Continuous Integration (CI)

This project uses GitHub Actions for CI.
On every pull request that changes files in the `auth/` folder, the following checks are automatically run:

- **Linting:** Runs Checkstyle via `./mvnw checkstyle:check`
- **Testing:** Runs all tests and checks coverage via `./mvnw clean verify jacoco:report` and `./mvnw jacoco:check`

You can find the workflow configuration in `.github/workflows/formulaai-ci.yml`.

---


