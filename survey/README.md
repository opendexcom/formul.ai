# survey-service

**Survey Management Microservice** for the `formulAI` platform.  
Built with **Spring Boot 3.4.5**, Java **24**, and Maven.  
Includes **OpenAPI UI** support via SpringDoc.

---

## ⚙️ Requirements

- Java 24 (JDK)
- Maven 3.8+
- (Optional) Docker (for future deployment)

---

## 🚀 Getting Started

### Clone the Repository

```bash
git clone https://your.repo.url/survey-service.git
cd survey-service
```

### Run the Application

Using the wrapper:

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

## ✅ Running Tests

```bash
mvn test
```

Output:

```text
BUILD SUCCESS
```

If not — fix it. No excuses.

---

## 📖 API Documentation

Access Swagger UI at:

```
http://localhost:8080/swagger-ui.html
```

---

## 📦 Maven Coordinates

- **Group ID:** `com.formulai`
- **Artifact ID:** `survey-service`
- **Version:** `0.0.1-SNAPSHOT`

---

## 🧱 Tech Stack

- Spring Boot Starter
- Spring Boot Test
- SpringDoc OpenAPI

---
