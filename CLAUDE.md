# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> 🚀 **Punto de entrada para una sesión nueva**: [`AGENTS/GLOBAL.md`](./AGENTS/GLOBAL.md) — resumen ejecutivo autocontenido del estado, stack, decisiones, gotchas, endpoints y pendientes. Léelo antes que cualquier otra cosa.

> **Source of truth del diseño**: [`AGENTS/`](./AGENTS/README.md) — ADRs, arquitectura, Gherkin, runbooks.
> **Estado al día por turno**: [`AGENTS/PROGRESS.md`](./AGENTS/PROGRESS.md).
> Para arrancar el repo de cero: [`README.md`](./README.md).

## Stack

NestJS 11.1 + Prisma 7 (PostgreSQL 17) + Redis 7 (`ioredis`) + Swagger. Package manager: **pnpm 9.15** (Corepack). Node 24 LTS pinneado en `engines`. Routes prefijadas `/api`; URI versioning con default `1`; Swagger en `/api/docs`.

Ver [`AGENTS/planning/01-stack-versions.md`](./AGENTS/planning/01-stack-versions.md) para versiones exactas y el porqué.

## Common commands

```sh
# Dev
pnpm start:dev
pnpm typecheck
pnpm lint                 # auto-fix
pnpm test:unit            # 98 tests, ~3s

# DB
pnpm db:migrate:dev       # crea migration en dev
pnpm db:migrate:deploy    # aplica pendientes (prod/CI)
pnpm db:seed              # roles + permisos del sistema
pnpm db:reset             # ⚠️ drop + recreate (solo dev)

# Stack completo
pnpm compose:up           # postgres + redis + api
pnpm compose:down         # con -v

# Build
pnpm build                # → dist/main.js
```

Tests integration y E2E requieren Docker (Testcontainers). Configs en `test/jest-{integration,e2e}.json` aún sin specs reales (TBD M3-M5).

## Migraciones (Prisma 7)

**El `url` ya no va en `schema.prisma`** — vive en `prisma.config.ts` que carga `dotenv` y lee `DATABASE_URL`. La generación del cliente requiere ese archivo (`pnpm prisma generate` lo carga automáticamente).

Sigue el patrón **Expand-Migrate-Contract** documentado en [`AGENTS/database/02-migration-strategy.md`](./AGENTS/database/02-migration-strategy.md). Cada migration tiene su `down.sql` adyacente. CI corre `squawk` sobre migrations modificadas y rechaza patterns peligrosos (`ALTER COLUMN ... NOT NULL DEFAULT`, `RENAME`, `DROP COLUMN` sin guardas, `CREATE INDEX` sin `CONCURRENTLY`).

`tsconfig.build.json` tiene `rootDir: ./src` — por eso el output queda en `dist/main.js` directo (no `dist/src/main.js`). El Dockerfile y el script `start:prod` asumen esto.

## Arquitectura

Hexagonal + DDD light por bounded context:

```
src/
├── main.ts                       # bootstrap (OTel → helmet → ValidationPipe → Swagger)
├── otel.ts                       # init OTel SDK condicional (importado primero)
├── app.module.ts                 # ConfigModule + Pino + Throttler(Redis) + Prisma + Redis + RbacModule + AuthModule + HealthModule
├── config/env.schema.ts          # Joi schema de envvars
├── shared/
│   ├── domain/                   # Result, Entity, AggregateRoot, ValueObject, DomainEvent, Specification, errors
│   ├── application/              # UseCase base, ports (IClock/IEventBus/IUnitOfWork), GlobalExceptionFilter
│   ├── infrastructure/           # PrismaService, RedisService, SystemClock, InMemoryEventBus
│   └── presentation/             # CorrelationIdInterceptor
└── modules/
    ├── auth/                     # email/password, refresh rotation, password reset, email verify, OAuth Google + GitHub
    ├── rbac/                     # Role/Permission, AbilityFactory (CASL), PoliciesGuard, @CheckPolicies
    └── health/                   # /api/health/{live,ready} con Terminus
```

Cada módulo: `domain/` (puro, cero NestJS/Prisma) → `application/` (use cases + ports) → `infrastructure/` (adapters Prisma/Redis/Argon/JWT/Mailer) → `presentation/` (controllers + DTOs + guards).

**Reglas de dependencia forzadas por ESLint** (`eslint-plugin-boundaries` en `eslint.config.mjs`):

- `domain/` ← solo `domain/` y `shared/`
- `application/` ← `domain/` + `application/` + `shared/`
- `infrastructure/`/`presentation/` pueden importar todo lo interno

Cross-bounded-context **prohibido** salvo via re-exports explícitos (ej. `RbacModule` exporta `PoliciesGuard` + `ABILITY_FACTORY` para que `AuthModule` arme el `AdminController`).

## Auth (M3 + M5)

- **Passwords**: argon2id (m=64MiB, t=3, p=1) — OWASP 2026 (`ArgonHasher`).
- **JWT**: RS256 con keypair (`JwtSigner` genera ephemeral en dev si no hay keys; obligatorio en prod).
- **Refresh tokens**: opaque 32-byte base64url, **hash sha256 en DB** (raw nunca persiste). Rotación + theft detection: usar refresh ya revocado → revoca toda la familia + emite evento `RefreshTokenReuseDetected`.
- **Cookies**: `HttpOnly; Secure (prod); SameSite=Strict; Path=/api/auth; signed`.
- **One-time tokens** (verify email / password reset): hash sha256, TTL diferenciado por purpose (24h verify, 30min reset), single-use.
- **Anti email-enumeration**: register, password-reset request y resend-verification responden 200/202 idéntico independientemente de si el email existe. Login es constant-time (hashea dummy si user no existe).
- **OAuth**: state CSRF en Redis con TTL 10min, single-use. `HandleOAuthCallbackUseCase` cubre 4 ramas: existing link → login / authed linker matches email → link / mismatch → conflict / new user (User con `passwordHash=null`, `emailVerifiedAt=now`).
- **Lockout**: 5 intentos fallidos en 10min → bloqueo 15min. Admin puede `POST /api/admin/users/:id/unlock` con permiso `unlock:User`.

## RBAC (M4)

CASL (`@casl/ability` + `@casl/prisma`). Permisos almacenados en DB (catálogo en `prisma/seed.ts`), no en código.

- `CaslAbilityFactory.createForUser(userId)` lee permisos efectivos vía `PrismaPermissionRepository.findEffectiveForUser` (deduplicado).
- `buildAbility(permissions, { user: { id } })` resuelve placeholders `$user.id` en CASL conditions (ABAC).
- `PoliciesGuard` + `@CheckPolicies((a) => a.can('unlock', 'User'))` decorator. Múltiples handlers se evalúan AND.
- **Cache de abilities en Redis con pub/sub invalidation**: pendiente (deferred — actualmente sin cache).

## Observabilidad

- **Logs**: `nestjs-pino`. JSON estructurado, redact automático (`authorization`, `cookie`, `password*`, `set-cookie`). Correlation ID por request via `genReqId` + `CorrelationIdInterceptor` que lee/genera `x-request-id`.
- **Traces + Metrics**: `src/otel.ts` con NodeSDK + auto-instrumentations (HTTP, Prisma, Redis, fetch). **Activación condicional**: solo arranca si `OTEL_EXPORTER_OTLP_ENDPOINT` está seteado — en dev sin OTel no se carga ni los deps.
- **Health**: `/api/health/live` (proceso, no toca deps), `/api/health/ready` (DB + Redis + version + uptime, falla con 503 si alguna dep no responde).

`src/main.ts` importa `./otel` **antes** de `reflect-metadata` y NestJS — orden crítico para que las auto-instrumentations enganchen.

## Throttler

`@nestjs/throttler` con storage Redis (`@nest-lab/throttler-storage-redis`) cuando `REDIS_URL` está seteado → contadores compartidos entre pods. Sin Redis → in-memory single-pod fallback. 3 buckets default (short 10/s, medium 100/min, long 1000/h) + `@Throttle(...)` granular en endpoints sensibles (login 5/10min, register 5/h, refresh 30/min, resend-verify 1/min, password-reset 5/10min).

## Errors → HTTP

`GlobalExceptionFilter` mapea:

- `DomainError` → su `httpStatus` + `code` + `message` (con `details` opcional)
- `HttpException` → pass-through con shape estándar
- `Prisma.PrismaClientKnownRequestError`: P2002→409 CONFLICT, P2025→404 NOT_FOUND, P2003→409 FK
- Cualquier otra cosa → 500 con log de `error` + `requestId`, sin leak de detalle al cliente

Body de error siempre incluye `code`, `message`, `path`, `requestId`, `timestamp`.

**Patron clave**: errores de dominio son **valores** (`Result.Err`), no excepciones. Use cases retornan `Promise<Result<T, DomainError>>`. Solo se `throw` desde el controller cuando hay que mapear a HTTP. Excepciones reales se reservan para fallas de infra (DB caída, timeouts).

## Configuración

`src/config/env.schema.ts` valida con Joi al boot — la app falla rápido si falta algo o tipo no matchea. Edita ahí cuando agregues envvars (y `.env.example`).

`prisma.config.ts` carga `DATABASE_URL` desde el ambiente para el CLI de Prisma (no se reusa el de NestJS).

## Tests

```
test/
├── unit/                # mirror de src/, sin DB. Mocks manuales.
├── integration/         # Testcontainers Postgres + Redis (TBD specs reales)
└── e2e/                 # supertest + AppModule completo (TBD)
```

Domain layer cubierto al 90%+ (Result/Specification/EventBus al 100%). Use cases con happy + cada `Result.Err`. Adapters Prisma/Redis se cubrirán en integration tests con Testcontainers cuando se agreguen.

## Tooling

- **Husky** + **lint-staged**: `pre-commit` corre `eslint --fix` + `prettier --write` sobre staged.
- **commitlint**: `commit-msg` valida Conventional Commits (`feat:`, `fix:`, `chore:`, etc.).
- **ESLint flat config** (`eslint.config.mjs`) con `typescript-eslint` + `eslint-plugin-prettier` + `eslint-plugin-boundaries`.
- **TypeScript strict + `noUncheckedIndexedAccess`**.

## CI (`.github/workflows/ci.yml`)

Jobs paralelos: `lint-and-typecheck`, `test-unit`, `test-integration` (services postgres + redis), `audit` (`pnpm audit --audit-level high`), `scan` (Trivy fs CRITICAL/HIGH), `migration-lint` (squawk solo sobre migrations modificadas), `build` (depende de unit + integration). Total target < 8min.

## Things to know

- **Prisma 7 ESM-first**: forzamos `moduleFormat = "cjs"` en `generator client` para compat con NestJS hasta v12.
- **Build output flat**: `tsconfig.build.json` con `rootDir: ./src` → `dist/main.js`. No mover sin actualizar Dockerfile + `start:prod`.
- **OTel deps son ~80MB** instaladas. El SDK no se inicializa salvo `OTEL_EXPORTER_OTLP_ENDPOINT` set, pero los deps siguen en `node_modules`. Si querés trim agresivo, mover a optional deps.
- **JWT keys ephemerales en dev**: tokens invalidan en cada restart de la app. Es a propósito; en prod las claves vienen de secret manager.
- **`prisma/seed.ts` es idempotente** y se ejecuta en CI/CD post-migrate. Roles `superadmin`, `admin`, `user` y catálogo de permisos viven ahí.
- **Cookie path `/api/auth`**: el navegador solo manda la refresh cookie a endpoints de auth — refuerzo defense-in-depth además de `SameSite=Strict`.

## Cuándo NO seguir hexagonal

CRUD trivial sin invariantes (un `notes` con get/create/delete) puede ir como controller-service-prisma plano dentro del bounded context. Hexagonal aporta cuando hay reglas de negocio con eventos, validaciones cruzadas, o cuando el dominio tiene que ser testeable sin contenedor. Si el controller es solo un mapper a Prisma, no fuerces el modelo.
