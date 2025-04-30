FROM openjdk:24-jdk-bullseye

WORKDIR /app

# Add a volume for temporary files
VOLUME /tmp

# Copy Maven/Gradle config files first to leverage Docker cache
COPY mvnw pom.xml ./
COPY .mvn ./.mvn
# Or if using Gradle
# COPY gradlew build.gradle settings.gradle ./
# COPY gradle ./gradle

# Download dependencies (will be cached if no changes)
RUN ./mvnw dependency:go-offline -B || true
# Or if using Gradle
# RUN ./gradlew dependencies || true

# Copy source code
COPY src ./src

RUN chmod +x ./mvnw

# Build the application
RUN ./mvnw package -DskipTests
# Or if using Gradle
# RUN ./gradlew build -x test

# Extract JAR file name using find to handle version numbers
RUN find target -name "*.jar" -not -name "*sources.jar" -not -name "*javadoc.jar" -exec cp {} app.jar \;
# Or if using Gradle
# RUN find build/libs -name "*.jar" -not -name "*sources.jar" -not -name "*javadoc.jar" -exec cp {} app.jar \;

ENV SPRING_PROFILES_ACTIVE=prod

# Run Spring Boot application
ENTRYPOINT ["java", "-jar", "app.jar"]
