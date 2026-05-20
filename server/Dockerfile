FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@10.23.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN pnpm config set store-dir /root/.local/share/pnpm/store
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

COPY server ./server
COPY client ./client

RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

RUN pnpm --filter server build

FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm@10.23.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN pnpm config set store-dir /root/.local/share/pnpm/store
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile --prod

COPY --from=builder /app/server/dist ./server/dist

WORKDIR /app/server

ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "dist/src/main"]
