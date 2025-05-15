# 🧠 formul.ai

**Code of forms. Powered by AI. Open source project.**

**formul.ai** is a system for creating and analyzing dynamic forms powered by local AI models. The platform enables users to build surveys or questionnaires with conditional logic, collect responses, and provide immediate, AI-driven results — all without sending data to external cloud services.

## ✨ Key Features

- Dynamic forms that adapt to user input
- Local AI-based analysis of responses
- Instant feedback and recommendations for respondents
- Admin panel for managing forms and results
- Full control over data privacy (on-premise processing)

## 👥 User Roles

- **Administrators**: create and manage forms, configure results, and access aggregated data.
- **Respondents**: fill out forms and receive personalized feedback instantly.

## 🚀 Project Goals

- Streamline data collection and interpretation using local AI
- Provide fast, personalized insight to users
- Ensure data privacy and compliance with regulations
- Encourage collaboration through open-source development

## 🔐 Privacy & Security

All processing, including AI analysis, is performed locally. This approach ensures user data remains private and compliant with data protection standards like GDPR.

## 🛠️ Technology Stack

- **Frontend**: React.js (v19), TypeScript, Tailwind CSS
- **Backend**:
  - Java Spring Boot (v3.4.5) for Survey Service
  - Python FastAPI for Processing Service
- **Database**: PostgreSQL (planned)
- **AI Integration**: Local AI models (planned)
- **Containerization**: Docker, Docker Compose
- **Testing**:
  - JUnit for Java
  - pytest for Python
  - React Testing Library (planned)

## 🧰 Required Tools

- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://www.npmjs.com/) (v9+) or [Yarn](https://yarnpkg.com/) (v1.22+)
- [Docker](https://www.docker.com/) and Docker Compose
- [Git](https://git-scm.com/)
- [PostgreSQL](https://www.postgresql.org/) (v14+)

## 🚀 Getting Started

### Installation

Clone the repository:

```bash
git clone https://github.com/opendexcom/formul.ai.git
cd formul.ai
```
### First run
To change configuration edit `.env` file.

### Run the Application

Run entire application using Docker Compose:

```bash
docker-compose up -d
```

Run docker with rebuilding:

```bash
docker-compose up --build -d
```

The application will be available at `http://localhost`.

## 📁 Repository

GitHub: [opendexcom/formul.ai](https://github.com/opendexcom/formul.ai)

## 🤖 Continuous Integration (CI)

This project uses GitHub Actions for CI.  
On every pull request, the following checks are automatically run depending on which files are changed:

- **Frontend:**  
  - Linting (`npm run lint`) if files in `frontend/` are changed  
  - End-to-end tests (`npm run test:e2e`) always run

- **Processing Service:**  
  - Dependency sync, linting (ruff), and tests (pytest) if files in `processing/` are changed

- **Survey Service:**  
  - Linting (Checkstyle) and tests (Maven) if files in `survey/` are changed

You can find the workflow configuration in `.github/workflows/formulaai-ci.yml`.

## 📜 License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. See the [LICENSE](./LICENSE) file for details.

## 🤝 Contributing

We welcome contributions! Stay tuned for the upcoming [CONTRIBUTING.md](./CONTRIBUTING.md), or star the repo to follow the project’s development.

---

_This README will be updated as the project evolves._
