# 02 — Docker (prod)

## Multi-stage Dockerfile

```dockerfile
# syntax=docker/dockerfile:1.7

# ---- Stage 1: deps ----
FROM node:24-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++ openssl
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

# ---- Stage 2: build ----
FROM node:24-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable \
 && pnpm prisma generate \
 && pnpm build \
 && pnpm prune --prod

# ---- Stage 3: runtime ----
FROM node:24-alpine AS runtime
WORKDIR /app

# Non-root user
RUN addgroup -S app && adduser -S app -G app

# Runtime deps only
RUN apk add --no-cache curl tini openssl

# OTel SDK init script
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./

ENV NODE_ENV=production \
    NODE_OPTIONS="--enable-source-maps" \
    PORT=3000

EXPOSE 3000

USER app

# tini as PID 1: clean signal handling for graceful shutdown
ENTRYPOINT ["/sbin/tini", "--"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/health/live || exit 1

CMD ["node", "dist/main.js"]
```

## Por qué cada decisión

- **`node:24-alpine`**: Node 24 LTS (Krypton) hasta 2028. Alpine: ~50MB base, footprint mínimo.
- **Multi-stage**: la imagen final no tiene compiladores (`python`, `g++`) — solo runtime.
- **`pnpm install --frozen-lockfile`**: reproducibilidad estricta. Falla si lockfile no matchea.
- **`pnpm prune --prod`**: elimina devDependencies del runtime.
- **Non-root user `app`**: defensa en profundidad. Si exploit RCE, no root.
- **`tini`**: Node.js de PID 1 maneja SIGTERM mal. tini reaper de zombies + propaga señales.
- **`HEALTHCHECK`**: Docker monitorea la app sin necesitar tools externos.
- **`COPY --from=build`**: cachea capas en docker registry.

## Migrations en deploy: ¿en CMD o en init container?

**Recomendado: init container (k8s) o paso separado en CI/CD.**

```yaml
# k8s deployment ejemplo
initContainers:
  - name: migrate
    image: <our-image>:latest
    command: ['pnpm', 'prisma', 'migrate', 'deploy']
    envFrom: [...]
```

Razones:

- Migrations se ejecutan **una vez por deploy**, no una vez por pod.
- Si la migration falla, el rollout se aborta antes de que pods nuevos reciban tráfico.
- Logs separados, más fácil debug.

Alternativa simpler (si no usas k8s): script de deploy en CI corre `prisma migrate deploy` antes de actualizar el servicio.

## Compose para staging

```yaml
# docker-compose.staging.yml
services:
  api:
    image: ghcr.io/yourorg/skeleton:${TAG:-latest}
    environment:
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      # ...
    ports: ['3000:3000']
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    healthcheck:
      test: ['CMD', 'curl', '-fsS', 'http://localhost:3000/api/health/ready']
      interval: 10s
      timeout: 5s
      retries: 6

  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: app
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes: [postgres_data:/var/lib/postgresql/data]
    healthcheck:
      test: ['CMD', 'pg_isready', '-U', 'app']

  redis:
    image: redis:7-alpine
    healthcheck: { test: ['CMD', 'redis-cli', 'ping'] }

volumes:
  postgres_data:
```

## Image size budget

- Base alpine: ~50MB
- Node 24 alpine: ~150MB
- App + node_modules prod: ~300–500MB total
- **Budget**: < 600MB. Si excede, audit `node_modules` (probablemente un dep gigante innecesario).

## Image scanning

CI corre Trivy / Snyk en cada build:

```yaml
- name: Trivy scan
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'ghcr.io/yourorg/skeleton:${{ github.sha }}'
    severity: 'CRITICAL,HIGH'
    exit-code: 1
```

Falla en `CRITICAL` o `HIGH`. `MEDIUM` reportado pero no bloquea (review manual).

## Graceful shutdown

NestJS:

```ts
// main.ts
const app = await NestFactory.create(AppModule);
app.enableShutdownHooks();
// ... start
```

Esto activa hooks `OnModuleDestroy` cuando llega SIGTERM. PrismaService cierra conexiones, Redis cierra cliente, queue workers terminan jobs in-flight.

K8s: `terminationGracePeriodSeconds: 30` debe darle tiempo. Si la app tiene long-running jobs, ajustar.

## Distroless alternative

Si el equipo prefiere distroless (sin shell, mínima superficie):

```dockerfile
FROM gcr.io/distroless/nodejs24-debian12 AS runtime
```

Trade-off: no `curl` en healthcheck (usa node script), no shell para debug. Mejor seguridad, peor DX en incidentes. **Decisión**: alpine por default, distroless cuando se justifique.
