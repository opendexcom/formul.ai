# FormulAI Server

Backend API and worker processes built with NestJS.

## Scripts

Run these commands from the `server/` directory:

```bash
pnpm dev
```

Starts API in watch mode.

```bash
pnpm build
pnpm start:prod
```

Builds and starts API in production mode.

```bash
pnpm worker:dev
pnpm worker:prod
```

Starts background analytics worker in development or production mode.

```bash
pnpm test
pnpm test:e2e
pnpm test:cov
```

Runs unit, e2e, and coverage tests.

```bash
pnpm lint
```

Runs ESLint.

## From Workspace Root

You can also run server scripts from the repository root:

```bash
pnpm --filter server dev
pnpm --filter server build
pnpm --filter server worker:dev
```
