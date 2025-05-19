# 🛠️ Technology Stack & Required Tools

## Technology Stack

- **Frontend**: React.js (v19), TypeScript, MUI, Vite
- **Backend Services**:
  - **Survey Service**: Java Spring Boot (v3.4.5)
  - **Processing Service**: Python FastAPI (see `pyproject.toml` for version)
- **Database**: PostgreSQL (v17-alpine, via Docker)
- **AI Integration**: Ollama (local AI models, via Docker)
- **Gateway**: Nginx (as reverse proxy and static file server)
- **Containerization & Orchestration**: Docker, Docker Compose
- **Testing**:
  - JUnit (Java)
  - pytest, pytest-asyncio, pytest-cov (Python)
  - React Testing Library, Cypress (Frontend)
  - Testcontainers (Java integration tests)
- **Other Tools**:
  - Flyway (database migrations)
  - Prettier, ESLint (Frontend linting/formatting)
  - Ruff, Black, MyPy (Python linting/formatting)
  - Storybook (UI component development)

## Required tools for development

| Tool                                                 | Purpose                                      |
|------------------------------------------------------|----------------------------------------------|
| [Docker](https://www.docker.com/) and Docker Compose | Containerization and orchestration           |
| [Java](https://adoptium.net/) (v21)                  | Java backends (Survey Service)               |
| [Maven](https://maven.apache.org/)                   | Java project build and dependency management |
| [Node.js](https://nodejs.org/) (v18+)                | Frontend development                         |
| [Python](https://www.python.org/) (v3.11+)           | AI-related backend (Processing Service)      |
| [uv](https://github.com/astral-sh/uv)                | Python dependency management (Processing Service) |
| [Git](https://git-scm.com/)                          | Version control                              |
