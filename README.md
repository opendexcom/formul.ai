
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

## 📦 Environment Setup

1. Copy and configure environment files:
   - `server/.env.example` → `server/.env`
   - `client/.env.example` → `client/.env`
2. Fill in required variables (see example files for details)
3. Start MongoDB and Redis:
   ```bash
   docker compose up -d
   ```
4. Install dependencies:
   ```bash
   pnpm install
   ```
5. Start dev servers:
   ```bash
   pnpm run dev
   ```
6. Access frontend: http://localhost:3000
7. Access API docs: http://localhost:3001/api/docs

## 🚀 Quick Start

```bash
git clone https://github.com/opendexcom/formul.ai.git
cd formul.ai
pnpm install
docker compose up -d
cp server/.env.example server/.env
cp client/.env.example client/.env
pnpm run dev
```

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
