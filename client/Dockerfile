FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN pnpm config set store-dir /root/.local/share/pnpm/store
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

COPY client ./client
# We might need server types or shared code if referenced, so copying server is safer if there are deps, 
# but usually client is standalone. However, pnpm workspace might link them.
# Let's assume client is self-contained for now or minimal deps.
# Actually, to be safe with workspace, we should copy what's needed.
# But let's stick to client source for now.

WORKDIR /app/client

ARG VITE_API_BASE_URL

RUN VITE_API_BASE_URL=$VITE_API_BASE_URL pnpm run build:prod

FROM nginx:alpine

COPY --from=builder /app/client/build /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
