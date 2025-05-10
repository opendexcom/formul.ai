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

## Project Structure

```
├── public/         # Static assets
├── src/            # Source code (components, pages, etc.)
├── tsconfig.json   # TypeScript configuration
├── vite.config.ts  # Vite configuration
├── package.json    # Project metadata and scripts
└── README.md       # This file
```
