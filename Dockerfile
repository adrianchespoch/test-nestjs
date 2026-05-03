# syntax=docker/dockerfile:1.7

# ---- deps ----
FROM node:22.22.2-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++ openssl
COPY package.json pnpm-lock.yaml ./
RUN corepack enable \
 && corepack prepare pnpm@9.15.0 --activate \
 && pnpm install --frozen-lockfile

# ---- build ----
FROM node:22.22.2-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable \
 && corepack prepare pnpm@9.15.0 --activate \
 && pnpm prisma generate \
 && pnpm build \
 && pnpm prune --prod

# ---- runtime ----
FROM node:22.22.2-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache wget tini openssl \
 && addgroup -S app && adduser -S app -G app

COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/package.json ./

ENV NODE_ENV=production \
    NODE_OPTIONS="--enable-source-maps" \
    PORT=3000

EXPOSE 3000

USER app

ENTRYPOINT ["/sbin/tini", "--"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health/live || exit 1

# Migrations corren al boot — para deploys con orquestador, mover a init container.
CMD ["sh", "-c", "node ./node_modules/.bin/prisma migrate deploy && node dist/main.js"]
