FROM node:24-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@10.23.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN pnpm config set store-dir /root/.local/share/pnpm/store
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

COPY client ./client

ARG VITE_API_BASE_URL

RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

RUN VITE_API_BASE_URL=$VITE_API_BASE_URL pnpm --filter client run build:prod

FROM nginx:alpine

COPY --from=builder /app/client/build /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
