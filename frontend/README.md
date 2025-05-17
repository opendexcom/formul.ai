# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

# formul.ai frontend

A **React** project built with **Vite** and **TypeScript**.

## Getting Started

Follow these instructions to set up and run the project locally.

### Prerequisites

- [Node.js](https://nodejs.org/) (version 16 or above recommended)
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/) or [yarn](https://yarnpkg.com/)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/your-username/formul.ai.git
cd formul.ai/frontend
```

2. Install dependencies:

```bash
npm install
```

_or if you prefer:_

```bash
yarn install
```

---

## Available Scripts

### `npm run dev`

Runs the app in development mode.

- Starts the Vite development server
- Hot Module Replacement (HMR) is enabled

```bash
npm run dev
```

Access the app at [http://localhost:5173](http://localhost:5173) (default port).

---

### `npm run build`

Builds the project for production.

- Compiles TypeScript files
- Bundles the app with Vite

```bash
npm run build
```

The output will be in the `dist/` folder.

---

### `npm run preview`

Previews the production build locally.

- Serves the contents of the `dist/` folder

```bash
npm run preview
```

Useful for verifying the production build before deployment.

---

### `npm run lint`

Lints the project using ESLint.

```bash
npm run lint
```

Fix any code issues for a clean and consistent codebase.

---

### `npm run storybook`

Runs Storybook in development mode.

```bash
npm run storybook
```

This will open Storybook in your browser, typically at http://localhost:6006.

---

### `npm run build-storybook`

Builds a static Storybook that you can deploy.

```bash
npm run build-storybook
```

The output will be in the storybook-static/ folder.

---

## 🤖 Continuous Integration (CI)

On every pull request, GitHub Actions will:

- Run `npm run lint` if any files in the `frontend/` directory are changed
- Always run end-to-end tests (`npm run test:e2e`)

See the root `.github/workflows/formulaai-ci.yml` for details.

## Project Structure

```
│── src/                             # Source code
├── features/                        # App features
│   ├── auth/                        # Auth feature
│   │   ├── components/              # Auth UI components
│   │   └── index.ts                 # Auth module exports
│   ├── surveys/                     # Surveys feature
│   │   ├── components/              # Surveys UI components
│   │   └── index.ts                 # Surveys module exports
│   └── shared/                      # Shared code
│       ├── components/              # Shared UI components
│       ├── hooks/                   # Shared hooks
│       ├── utils/                   # Shared utils
│       └── index.ts                 # Source code (components, pages,etc.)
├── tsconfig.json                    # TypeScript configuration
├── vite.config.ts                   # Vite configuration
├── package.json                     # Project metadata and scripts
└── README.md                        # This file
```

## How to add a new feature

### 🛠️ Guidelines

1. **Create a folder under `src/features/`** with a meaningful name (e.g. `profile`, `dashboard`, etc.).
2. **Structure it consistently**: use `components/`, `hooks/`, and `index.ts` to organize exports.
3. **Keep logic isolated**: reusable logic or UI should be placed in `src/features/shared/`.
4. **Export everything through `index.ts`** to keep imports clean and consistent.
5. **Write tests** for new logic or components if applicable.
6. **Document components with Storybook** when relevant.

### 📦 Import examples

Here are a few examples of how to import shared utilities or components:

```tsx
import { AppBar } from '@/features/shared/components/AppBar'

import { useAuth } from '@/features/shared/hooks/useAuth'

import { formatDate } from '@/features/shared/utils/date'
```
