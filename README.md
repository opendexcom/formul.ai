
# 🧠 FormulAI

**AI-Powered Survey Analytics Platform**

FormulAI is an intelligent survey platform that combines intuitive form building with advanced AI-powered analytics. It automatically analyzes open-ended responses using research-grade qualitative methods, delivering actionable insights in minutes.

## ✨ Key Features

- AI-assisted form builder (10+ question types, conditional logic)
- Real-time analytics: sentiment, topic extraction, theme clustering
- Executive summary, findings, recommendations (LLM-powered)
- Interactive dashboard with 13 analytics cards
- Export to CSV and analytics reports
- JWT authentication, role-based access
- Scalable queue-based architecture (Bull + Redis)

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript 5, Vite, Tailwind CSS
- **Backend**: NestJS 10, TypeScript 5, Node.js 18+
- **Database**: MongoDB 5.0+
- **Queue System**: Bull (Redis-backed)
- **AI Integration**: OpenAI GPT-4o
- **Authentication**: JWT
- **Containerization**: Docker, Docker Compose

## 🏗️ Architecture Overview

Layered architecture:

1. **Client Layer**: React 19, Tailwind CSS
2. **API Layer**: NestJS REST controllers, JWT guards, Swagger docs
3. **Service Layer**: Business logic (Forms, Auth, Analytics, AI)
4. **Queue Layer**: Bull queues for async analytics (orchestration, response processing, topic clustering, aggregation, AI generation)
5. **Data Layer**: MongoDB with Mongoose ODM

See `docs/ARCHITECTURE.md` for details.


## 🚀 Quick Start

### Option 1: Full Docker Deployment (Recommended)

Run the entire system (Frontend, Backend, Database, Redis, Mailhog) with Docker.

```bash
# 1. Clone the repository
git clone https://github.com/opendexcom/formul.ai.git
cd formul.ai

# 2. Configure environment variables
cp server/.env.example server/.env
# Edit server/.env as needed (see Configuration section below)

# 3. Start the system
docker compose up -d
```

Access the services:
- **Frontend**: http://localhost (via Nginx Gateway)
- **Backend API**: http://localhost:3001
- **Mongo Express**: http://localhost:8081
- **Mailhog** (Email Testing): http://localhost:8025

### Option 2: Local Development

Run infrastructure in Docker, but application code locally for development.

```bash
# 1. Install dependencies
pnpm install

# 2. Start Infrastructure (MongoDB, Redis, Mailhog)
docker compose up -d mongodb redis mailhog mongo-express

# 3. Start Development Servers
pnpm run dev
```

Access the frontend at http://localhost:3000.

## ⚙️ Configuration

The application is configured via environment variables in `server/.env` and `client/.env`.

### OpenAI Configuration (Required for AI features)

To enable AI-powered summaries and insights, you must provide an OpenAI API key.

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | Your OpenAI API Key | (Required) |
| `OPENAI_MODEL` | Model to use for generation | `gpt-4o-mini` |

### SMTP / Email Configuration

Configure email delivery settings. For local development, **Mailhog** is pre-configured to capture emails.

| Variable | Description | Default (Local) |
|----------|-------------|-----------------|
| `SMTP_HOST` | SMTP Server Host | `localhost` (or `mailhog` in Docker) |
| `SMTP_PORT` | SMTP Server Port | `1025` |
| `SMTP_USER` | SMTP Username | `user` |
| `SMTP_PASS` | SMTP Password | `pass` |
| `FROM_EMAIL` | Sender address | `FormulAI <noreply@formulai.com>` |

> **Note:** When running via `docker compose up`, the backend automatically connects to the `mailhog` service. If running the backend locally, use `localhost`.

## 📁 Repository

GitHub: [opendexcom/formul.ai](https://github.com/opendexcom/formul.ai)

## 🤖 Continuous Integration (CI)

GitHub Actions run lint, tests, and build checks for both frontend and backend. See `.github/workflows/` for details.

## 📜 License

This project is dual-licensed:

1.  **Open Source**: Licensed under the **GNU Affero General Public License v3.0 (AGPLv3)**. See the [LICENSE](./LICENSE) file for details.
2.  **Enterprise**: For commercial use without the obligations of AGPLv3, please contact us for an enterprise license.

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

_This README will be updated as the project evolves._
