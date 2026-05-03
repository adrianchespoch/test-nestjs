# NestJS Skeleton

Production-ready NestJS skeleton: hexagonal architecture + DDD building blocks, Prisma + PostgreSQL 17, JWT (RS256) + OAuth2 (Google + GitHub), RBAC (CASL), pino + OpenTelemetry, Husky + commitlint + ESLint flat. Argon2id passwords, refresh-token rotation with theft detection, expand-contract migrations.

> **Source of truth del diseño**: [`AGENTS/`](./AGENTS/README.md) — ADRs, arquitectura, Gherkin features, runbooks, readiness checklist.
> **Estado actual**: [`AGENTS/PROGRESS.md`](./AGENTS/PROGRESS.md).

## Quickstart

Requiere Node 24, pnpm 9, Docker (para Postgres + Redis locales).

```sh
# 1. Instalar deps + generar Prisma client
pnpm install

# 2. Crear .env
cp .env.example .env
# (edita los placeholders si vas a probar OAuth o SMTP real;
#  para arrancar local con email/password no hace falta tocar nada)

# 3. Levantar Postgres + Redis + API
pnpm compose:up

# 4. Aplicar migraciones + seed (en otra terminal)
pnpm db:migrate:deploy
pnpm db:seed

# 5. Verificar
curl -s http://localhost:3000/api/health/ready | jq
open http://localhost:3000/api/docs   # Swagger
```

Si querés correr la app sin Docker (Postgres + Redis ya corriendo localmente):

```sh
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/skeleton \
REDIS_URL=redis://localhost:6379 \
pnpm start:dev
```

## Stack

| Capa             | Tech                                      |
| ---------------- | ----------------------------------------- |
| Runtime          | Node 24 LTS                               |
| Framework        | NestJS 11.1                               |
| ORM              | Prisma 7.x (Postgres 17)                  |
| Cache / queues   | Redis 7 (`ioredis`)                       |
| Auth             | argon2id + JWT RS256 + refresh rotation   |
| OAuth            | Passport (Google, GitHub)                 |
| Authorization    | CASL (RBAC + ABAC + query filtering)      |
| Validation       | class-validator + Joi (envvar schema)     |
| Rate limit       | `@nestjs/throttler` con storage Redis     |
| Security headers | helmet + signed HttpOnly cookies          |
| Logger           | pino (`nestjs-pino`) con redact PII       |
| Observability    | OpenTelemetry SDK + auto-instrumentations |
| Tests            | Jest + supertest + Testcontainers         |
| Container        | Docker multi-stage + non-root + tini      |

Ver [`AGENTS/planning/01-stack-versions.md`](./AGENTS/planning/01-stack-versions.md) para versiones exactas y razonamiento.

## Arquitectura

Hexagonal + DDD light, organizada por bounded context:

```
src/
├── main.ts              # bootstrap (OTel → Nest → helmet → ValidationPipe → Swagger)
├── otel.ts              # init OTel SDK (condicional por env)
├── app.module.ts
├── config/              # envvar schema (Joi)
├── shared/              # kernel: Result, Entity, AggregateRoot, ValueObject, etc.
└── modules/
    ├── auth/            # email/password, refresh, password reset, email verify, OAuth
    ├── rbac/            # roles, permisos, AbilityFactory, PoliciesGuard
    └── health/          # /api/health/{live,ready}
```

Cada módulo tiene `domain/` (puro), `application/` (use cases + ports), `infrastructure/` (adapters Prisma/Redis/Argon/JWT/SMTP), `presentation/` (controllers + DTOs + guards).

Reglas de dependencia forzadas con `eslint-plugin-boundaries`. Ver [`AGENTS/architecture/03-folder-layout.md`](./AGENTS/architecture/03-folder-layout.md).

## Comandos comunes

```sh
# Desarrollo
pnpm start:dev          # watch mode con hot reload
pnpm typecheck
pnpm lint               # con --fix
pnpm format

# DB
pnpm db:migrate:dev     # crea migration desde diff schema (dev)
pnpm db:migrate:deploy  # aplica pendientes (prod / CI)
pnpm db:seed            # roles + permisos del sistema
pnpm db:reset           # ⚠️ drop + recreate (solo dev)

# Tests
pnpm test:unit          # 98 tests, ~3s
pnpm test:cov           # con coverage report
pnpm test:integration   # Testcontainers Postgres + Redis (requiere Docker)
pnpm test:e2e

# Docker
pnpm compose:up
pnpm compose:down       # con -v (borra volumes)

# Build
pnpm build              # → dist/main.js
pnpm start:prod         # node dist/main
```

## Endpoints (resumen)

Todos bajo `/api`. Swagger UI en `/api/docs`.

| Método | Ruta                               | Auth                    | Descripción                                       |
| ------ | ---------------------------------- | ----------------------- | ------------------------------------------------- |
| POST   | `/api/auth/register`               | —                       | Registro email+password (envía verify email auto) |
| POST   | `/api/auth/login`                  | —                       | Login → access (body) + refresh (cookie HttpOnly) |
| POST   | `/api/auth/refresh`                | cookie                  | Rota refresh + emite nuevo access                 |
| POST   | `/api/auth/logout`                 | cookie                  | Revoca refresh actual + sesión                    |
| GET    | `/api/auth/email/verify`           | —                       | Verifica email vía one-time token                 |
| POST   | `/api/auth/email/verify/resend`    | —                       | Reenvía verify email (anti-enumeration)           |
| POST   | `/api/auth/password-reset/request` | —                       | Pide reset email (anti-enumeration)               |
| POST   | `/api/auth/password-reset/confirm` | —                       | Aplica nuevo password + revoca todas las sesiones |
| GET    | `/api/auth/google`                 | —                       | Inicia OAuth Google con state CSRF                |
| GET    | `/api/auth/google/callback`        | —                       | Callback Google                                   |
| GET    | `/api/auth/github`                 | —                       | Inicia OAuth GitHub                               |
| GET    | `/api/auth/github/callback`        | —                       | Callback GitHub                                   |
| POST   | `/api/admin/users/:id/unlock`      | JWT + `unlock:User`     | Desbloquea cuenta (RBAC)                          |
| GET    | `/api/rbac/roles`                  | JWT + `read:Role`       | Lista roles + permisos                            |
| GET    | `/api/rbac/permissions`            | JWT + `read:Permission` | Catálogo de permisos                              |
| POST   | `/api/rbac/users/:id/roles`        | JWT + `update:User`     | Asigna rol al user                                |
| DELETE | `/api/rbac/users/:id/roles/:name`  | JWT + `update:User`     | Quita rol                                         |
| GET    | `/api/health/live`                 | —                       | Liveness (proceso)                                |
| GET    | `/api/health/ready`                | —                       | Readiness (DB + Redis + metadata)                 |

## Seguridad

- **Passwords**: argon2id (m=64MiB, t=3, p=1) — OWASP 2026.
- **JWT**: RS256 con keypair (genera ephemeral en dev si no hay keys; obligatorio en prod).
- **Refresh tokens**: opaque 32-byte base64url, hash sha256 en DB, rotación + theft detection (revoca toda la familia).
- **Cookies**: `HttpOnly; Secure (prod); SameSite=Strict; Path=/api/auth; signed`.
- **Throttler**: granular por endpoint + storage Redis multi-pod.
- **CORS**: lista blanca explícita desde `CORS_ORIGINS`.
- **Headers**: helmet con HSTS, CSP, X-Frame-Options.
- **OAuth**: state CSRF con TTL 10min, single-use.
- **Logs**: redact automático de `authorization`, `cookie`, `password`, `currentPassword`, `newPassword`, `set-cookie`.

Ver [`AGENTS/architecture/cross-cutting/security.md`](./AGENTS/architecture/cross-cutting/security.md) para detalle.

## Migraciones

Sigue el patrón **Expand-Migrate-Contract** documentado en [`AGENTS/database/02-migration-strategy.md`](./AGENTS/database/02-migration-strategy.md):

1. **Expand**: agrega columna nullable / nuevo índice CONCURRENTLY / FK NOT VALID.
2. **Migrate**: backfill idempotente en lotes.
3. **Contract**: drop columna vieja **después** de retirar la versión que la usaba.

CI lintea las migrations modificadas con `squawk` y rechaza patterns peligrosos (`ALTER ... NOT NULL DEFAULT`, `RENAME`, `DROP COLUMN` sin guards).

Si una migration falla en prod: ver [`AGENTS/database/03-rollback-runbook.md`](./AGENTS/database/03-rollback-runbook.md) (cada migration tiene `down.sql`).

## Observabilidad

- **Logs**: pino JSON estructurado, correlation ID por request (`x-request-id`).
- **Traces**: OpenTelemetry SDK auto-instrumenta HTTP, Prisma, Redis. Activación condicional por `OTEL_EXPORTER_OTLP_ENDPOINT`.
- **Metrics**: histograms de latencia + counters por OTLP.
- **Health checks**: `/api/health/live` (proceso), `/api/health/ready` (DB + Redis + version + uptime).

## Cómo extender

- **Agregar un nuevo bounded context** (ej. `posts`): copiar layout de `auth/` o `rbac/`. ESLint forzará reglas de capas.
- **Agregar permisos**: editar `prisma/seed.ts` y `pnpm db:seed`.
- **Agregar OAuth provider**: nuevo strategy en `auth/presentation/strategies/`, adaptar `OAuthController` y `HandleOAuthCallbackUseCase`.
- **Cambiar mailer dev → SES/Resend**: implementar `IEmailSender` y reemplazar binding en `AuthModule`.

## Templating

Para arrancar un proyecto nuevo:

```sh
gh repo create my-new-app --template <this-repo>
cd my-new-app
pnpm install
node scripts/init-project.mjs my-new-app   # renombra package + regenera secrets dev
git add -A && git commit -m "chore: bootstrap from skeleton"
```

Ver [`AGENTS/PROGRESS.md`](./AGENTS/PROGRESS.md) para qué milestones del skeleton están al 100% vs. parciales.

## Convenciones

- **Conventional Commits** validados por commitlint en `commit-msg` hook (ej. `feat: add admin unlock endpoint`).
- **Pre-commit**: `lint-staged` corre eslint --fix + prettier sobre staged.
- **Branch protection**: `main` requiere PR + CI verde.

## Licencia

MIT — ver [`LICENSE`](./LICENSE).
