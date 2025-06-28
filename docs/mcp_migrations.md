# 🔄 MCP (Message Context Protocol) Migration TODO List

## 📋 Overview
This document outlines the necessary changes to implement MCP integration between Survey Service and Processing Service as described in the formul.ai architecture.

---

## 🎯 Survey Service (Spring Boot) - MCP Server Implementation

### ✅ TODO: MCP Server Setup
- [ ] **Add Spring AI MCP Server dependency** in `survey/pom.xml`
  ```xml
  <dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-mcp-server-webflux-spring-boot-starter</artifactId>
  </dependency>
  ```

- [ ] **Create MCP Configuration**
  - [ ] Add MCP server configuration in `application.properties`
  - [ ] Configure basic MCP endpoint settings

### ✅ TODO: MCP Tool Methods
- [ ] **Implement @Tool annotated methods**
  - [ ] `@Tool getFormContext(String formId)` 
    - Returns form structure, fields, metadata, basic statistics
  - [ ] `@Tool getFormResponse(String responseId)`
    - Returns individual response data
  - [ ] `@Tool getListOfResponses(String formId)`
    - Returns list of responses for a form

### ✅ TODO: Processing Service Communication
- [ ] **Create ProcessingServiceClient**
  - [ ] HTTP client to call Processing Service
  - [ ] `POST /start-processing { formId }` endpoint call
  - [ ] Retry logic and error handling
  - [ ] Add circuit breaker pattern

- [ ] **Update Form Entity**
  - [ ] Add `analysisStatus` field (PENDING, IN_PROGRESS, DONE, ERROR)
  - [ ] Add `analysisStartedAt` timestamp

---

## 🐍 Processing Service (Python) - MCP Client Implementation

### ✅ TODO: MCP Client Setup
- [ ] **Add MCP Client Dependencies**
  - [ ] Add `httpx` or `requests` to `pyproject.toml`
  - [ ] Add MCP client library (or implement custom)

### ✅ TODO: MCP Client Implementation
- [ ] **Create MCPClient class**
  - [ ] HTTP client configuration with Survey Service base URL
  - [ ] Error handling and retry mechanisms
  - [ ] Rate limiting and backoff strategies

- [ ] **Implement MCP Tool Calls**
  - [ ] `get_form_context(form_id: str)` method
  - [ ] `get_form_response(response_id: str)` method
  - [ ] `get_list_of_responses(form_id: str)` method

### ✅ TODO: Response Processing Logic
- [ ] **Create ResponseProcessor**
  - [ ] Download form context and response data via MCP
  - [ ] Process individual responses efficiently
  - [ ] Handle large response datasets

### ✅ TODO: Analysis Pipeline Integration
- [ ] **Update AnalysisService**
  - [ ] Integrate MCP client calls into analysis pipeline
  - [ ] Replace direct database access with MCP data retrieval
  - [ ] Process form context and responses via MCP tools

### ✅ TODO: API Endpoint Updates
- [ ] **Modify /start-processing endpoint**
  - [ ] Accept `formId` in request body
  - [ ] Validate form exists via MCP
  - [ ] Start background analysis task
  - [ ] Return analysis job ID for tracking

---

## 🔒 Security & Data Integrity

### ✅ TODO: Basic Security
- [ ] **Survey Service Security**
  - [ ] Add rate limiting for MCP calls
  - [ ] Implement request logging and monitoring

### ✅ TODO: Data Integrity
- [ ] **Request Validation**
  - [ ] Validate form and response IDs in MCP requests
  - [ ] Add request parameter validation
  - [ ] Implement proper error responses for invalid requests

---

## 📊 Monitoring & Observability

### ✅ TODO: Logging & Metrics
- [ ] **Survey Service Monitoring**
  - [ ] Add MCP request/response logging
  - [ ] Track MCP tool method performance
  - [ ] Monitor MCP endpoint usage
  - [ ] Add request validation alerts

- [ ] **Processing Service Monitoring**
  - [ ] Log MCP client interactions
  - [ ] Track form data retrieval performance
  - [ ] Monitor analysis pipeline health
  - [ ] Add retry and failure metrics

### ✅ TODO: Error Handling
- [ ] **Comprehensive Error Handling**
  - [ ] MCP connection failures
  - [ ] Invalid form/response ID errors
  - [ ] Timeout and retry logic

---

## 🧪 Testing Strategy

### ✅ TODO: Unit Tests
- [ ] **Survey Service Tests**
  - [ ] MCP tool method tests
  - [ ] Form context retrieval tests
  - [ ] Response data access tests
  - [ ] Security configuration tests

- [ ] **Processing Service Tests**
  - [ ] MCP client tests with mocked responses
  - [ ] Form data processing tests
  - [ ] Error handling tests

### ✅ TODO: Integration Tests
- [ ] **End-to-End MCP Flow**
  - [ ] Form context retrieval → response data access → analysis
  - [ ] Test with various form sizes and types
  - [ ] Test with different response volumes
  - [ ] Test error scenarios and recovery

---

## 🚀 Deployment & Configuration

### ✅ TODO: Environment Configuration
- [ ] **Survey Service Config**
  - [ ] MCP server port and basic settings
  - [ ] Processing Service endpoint URLs
  - [ ] Form and response data access configuration

- [ ] **Processing Service Config**
  - [ ] Survey Service MCP endpoint URLs
  - [ ] MCP client timeout and retry settings
  - [ ] Analysis pipeline configuration

### ✅ TODO: Docker & Infrastructure
- [ ] **Update Docker Configurations**
  - [ ] Add MCP-related environment variables
  - [ ] Configure service discovery for MCP endpoints
  - [ ] Update docker-compose with new networking requirements
  - [ ] Add health checks for MCP connectivity
