# GLOBAL — punto de entrada

> Lee esto **primero** en cualquier sesión nueva. Resume todo el estado del skeleton al 2026-05-03 sin requerir abrir el resto de archivos. Si necesitas detalle de un tema concreto, los punteros al final apuntan a la sección correspondiente.

---

## 1. Qué es este repo

NestJS skeleton production-ready, **reutilizable como template** para nuevos proyectos. Implementa hexagonal architecture + DDD building blocks + auth completa (email/password + OAuth2) + RBAC con CASL + observabilidad OTel + caching two-tier + migraciones expand-contract.

- **Filosofía**: dominio puro (cero NestJS/Prisma) en cada bounded context, ports & adapters, errores como valores (`Result<T, E>`), eventos de dominio, invariantes en aggregates.
- **Origen**: arrancó como demo NestJS 10 + TypeORM + MySQL; reescrito por completo a stack moderno.
- **Estado**: deployable a prod en hot path; pendientes son E2E reales y operacionales.

---

## 2. Stack lock-in (May 2026)

| Capa             | Tech                                                      | Versión                        |
| ---------------- | --------------------------------------------------------- | ------------------------------ |
| Runtime          | Node.js LTS                                               | 24 (Krypton)                   |
| Package mgr      | pnpm + Corepack                                           | 9.15                           |
| Framework        | NestJS                                                    | 11.1                           |
| Lenguaje         | TypeScript strict                                         | 5.6+                           |
| ORM              | Prisma                                                    | 7.x (cjs)                      |
| DB               | PostgreSQL                                                | 17                             |
| Cache            | Redis                                                     | 7 (ioredis)                    |
| Auth (passwords) | argon2id                                                  | OWASP 2026 (m=64MB, t=3, p=1)  |
| Auth (tokens)    | RS256 JWT + opaque refresh sha256                         | rotation + theft detection     |
| Auth (OAuth)     | passport-google-oauth20 + passport-github2                | state CSRF Redis 10min         |
| AuthZ            | `@casl/ability` + `@casl/prisma`                          | RBAC + ABAC                    |
| Rate limit       | `@nestjs/throttler` + `@nest-lab/throttler-storage-redis` | multi-pod safe                 |
| Security         | helmet + signed HttpOnly cookies + Joi env schema         | —                              |
| Logger           | pino (`nestjs-pino`)                                      | redact PII automático          |
| Tracing/metrics  | `@opentelemetry/sdk-node`                                 | OTLP HTTP, condicional por env |
| Tests            | Jest + supertest + Testcontainers                         | 109 unit verdes                |

Ver detalle en [`planning/01-stack-versions.md`](./planning/01-stack-versions.md).

---

## 3. Estado de milestones (snapshot)

| M   | Tema                | Estado  | Lo que falta                                        |
| --- | ------------------- | ------- | --------------------------------------------------- |
| M0  | Documentation       | ✅      | — (35 .md + 19 .feature + 80 scenarios + 7 ADRs)    |
| M1  | Bootstrap & infra   | ✅      | docker-compose smoke en local del usuario           |
| M2  | Domain kernel       | ✅      | —                                                   |
| M3  | Auth email/password | ✅      | E2E con Postgres real (Testcontainers)              |
| M4  | RBAC con CASL       | ✅      | CRUD completo de roles (no hot-path) + E2E          |
| M5  | OAuth2 social       | 🟡 ~85% | E2E con `nock` mockeando providers                  |
| M6  | Hardening prod      | 🟡 ~85% | runbook ensayado en staging (operativo)             |
| M7  | Templating          | 🟡 ~85% | marcar repo como GitHub template (config en GitHub) |

**Hot path al 100%.** Lo pendiente es:

1. E2E reales (necesitan Docker corriendo — el usuario los corre en su máquina)
2. Cosas operativas (config en GitHub, ensayo en staging)
3. CRUD adicional de roles (no necesario para deploy inicial)

Ver `PROGRESS.md` para changelog detallado por turno.

---

## 4. Decisiones lock-in (ADRs)

| #   | Tema             | Decisión                                                                                                                                   |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 001 | ORM              | **Prisma 7** (no TypeORM). cjs forzado por compat NestJS                                                                                   |
| 002 | Arquitectura     | **Hexagonal + DDD light** por bounded context, capas forzadas por ESLint boundaries                                                        |
| 003 | Password hashing | **argon2id** m=64MB t=3 p=1 (OWASP 2026)                                                                                                   |
| 004 | JWT delivery     | **Access en body** (memoria cliente) + **refresh en cookie** `HttpOnly; Secure (prod); SameSite=Strict; Path=/api/auth; signed`            |
| 005 | Authorization    | **CASL RBAC + ABAC**, conditions con placeholder `$user.id` resolvable                                                                     |
| 006 | Observabilidad   | **pino + OpenTelemetry** desde día 1; OTel condicional por `OTEL_EXPORTER_OTLP_ENDPOINT`                                                   |
| 007 | Migraciones      | **Expand-Migrate-Contract** zero-downtime; cada migration con `down.sql`; squawk en CI                                                     |
| 008 | DI               | **Contenedor de NestJS también en `application/`** (acoplamiento consciente vía `@Injectable` + `@Inject(SYMBOL)`). Domain queda 100% pura |

Sources de verdad en [`planning/decisions/`](./planning/decisions/).

**Decisiones operativas adicionales (no en ADR formal pero lock-in):**

- Single-tenant (no multi-tenancy en v1; agregar via Prisma `$extends` cuando aparezca el caso)
- Conventional Commits validados por commitlint en `commit-msg`
- Pre-commit `lint-staged` (eslint --fix + prettier)
- Reglas de capas hexagonales forzadas por `eslint-plugin-boundaries`
- Build flat (`tsconfig.build.json` con `rootDir: ./src` → `dist/main.js` directo)
- Anti email-enumeration en register / password-reset / resend-verify (siempre 200/202 idempotente)
- Login constant-time (hashea dummy si user no existe)
- Refresh tokens con rotación + theft detection (revoca toda la familia ante reuso)
- Cache abilities con generation-counter invalidation (no SCAN/DEL)

### Política de DI (resumen del ADR-008)

Usamos el **contenedor de NestJS** también para `application/`. Es decisión consciente, documentada y delimitada:

```ts
// application/use-cases/login.use-case.ts
@Injectable()                                                  // ← acoplamiento controlado
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private users: IUserRepository,   // ← Symbol como token DI
    @Inject(HASHER) private hasher: IHasher,
    // ...
  ) {}
  async execute(input: LoginInput): Promise<Result<...>> {
    // body 100% TypeScript estándar — cero NestJS, cero Prisma
  }
}
```

**Lo que SÍ está acoplado a NestJS** (lock-in consciente):

- `application/use-cases/*.ts` importa `@Injectable, @Inject` de `@nestjs/common`
- Constructors usan `@Inject(SYMBOL)` para resolver ports

**Lo que NO está acoplado (preservado e invariante):**

- `domain/` 100% pura: cero `@nestjs`, cero `@prisma`, cero `@Injectable`. **Forzado por ESLint `boundaries/element-types`** — la build cae si alguien lo viola
- Ports son `interface` puras + `Symbol` exportado. La interface no lleva metadata de Nest
- El `execute()` body de cada use case es TypeScript estándar — `Result<T,E>` + ports + await
- **Tests unitarios construyen use cases con `new`** (sin `Test.createTestingModule`). Las 109 specs lo demuestran. La unidad bajo test es framework-independiente

**Reglas que la decisión no afloja:**

- Use cases NO acceden a `Logger`, `ConfigService`, ni `HttpException` del framework. Para logging usan un port (`ILogger`); para errores usan `Result.Err`; el controller mapea a HTTP.
- Si necesitamos remover el acoplamiento (Lambda, CLI, multi-runtime): plan B documentado en ADR-008. Coste estimado ~2h de refactor mecánico, sin reescribir tests.

Por qué descartamos las alternativas:

- **`tsyringe`/`inversify`**: dos contenedores conviviendo (presentation sigue usando Nest para guards/interceptors). Complejidad sin payoff hasta que aparezca otro framework.
- **Composition root manual**: `useFactory` por use case → pierde resolución transitiva, costo continuo alto.

Detalle completo: [`planning/decisions/ADR-008-di-with-nestjs-container.md`](./planning/decisions/ADR-008-di-with-nestjs-container.md).

---

## 5. Estructura del repo

```
.
├── AGENTS/                      # 📍 source of truth del diseño
│   ├── GLOBAL.md                # ESTE archivo (punto de entrada)
│   ├── PROGRESS.md              # changelog por turno + tablas de avance
│   ├── README.md                # índice por categoría
│   ├── planning/
│   │   ├── 00-context.md
│   │   ├── 01-stack-versions.md
│   │   ├── 02-roadmap.md
│   │   └── decisions/ADR-001..007
│   ├── architecture/            # hexagonal + DDD + SOLID + design patterns + cross-cutting
│   ├── features/                # 19 .feature Gherkin (80 scenarios) — auth, rbac, users, health
│   ├── database/                # prisma setup, migration strategy, rollback runbook, seed
│   ├── testing/                 # strategy, Testcontainers, fixtures, coverage policy
│   └── prod/                    # config & secrets, Docker, CI/CD, incident runbook, readiness
│
├── prisma/
│   ├── schema.prisma            # User, Role, Permission, RolePermission, UserRole, Session, RefreshToken, AccountProvider, OneTimeToken
│   ├── seed.ts                  # roles + permisos del sistema (idempotente)
│   └── migrations/
│       ├── migration_lock.toml  # postgresql
│       └── 20260503000000_init/
│           ├── migration.sql    # 185 líneas
│           └── down.sql         # rollback manual
├── prisma.config.ts             # Prisma 7 — DATABASE_URL vive aquí, NO en schema
│
├── src/                         # 109 archivos .ts
│   ├── main.ts                  # bootstrap: OTel → reflect → Nest → helmet → compression → ValidationPipe → Swagger
│   ├── otel.ts                  # condicional por OTEL_EXPORTER_OTLP_ENDPOINT
│   ├── app.module.ts            # ConfigModule(Joi) + Pino + Throttler(Redis storage) + Prisma + Redis + Shared + Rbac + Auth + Health
│   ├── config/env.schema.ts     # Joi schema completo
│   ├── shared/
│   │   ├── domain/              # Result, Entity, AggregateRoot<TId>, ValueObject<Props>, DomainEvent, BaseDomainEvent, Specification, errors/DomainError + 6 subclases
│   │   ├── application/
│   │   │   ├── filters/global-exception.filter.ts   # Domain → HTTP, Prisma codes, fallback 500 sin leak
│   │   │   ├── ports/{clock,event-bus,unit-of-work}.port.ts
│   │   │   └── use-case.ts      # base type
│   │   ├── infrastructure/
│   │   │   ├── prisma/{prisma.service,prisma.module}.ts (con truncateAllForTests)
│   │   │   ├── redis/{redis.service,redis.module,redis.constants}.ts (REDIS_CLIENT puede ser null)
│   │   │   ├── clock/system-clock.ts
│   │   │   └── event-bus/in-memory-event-bus.ts
│   │   └── presentation/interceptors/correlation-id.interceptor.ts
│   └── modules/
│       ├── auth/                # 57 archivos
│       ├── rbac/                # 25 archivos (incluye AbilityCacheStore)
│       └── health/              # /api/health/{live,ready} con Terminus
│
├── test/
│   ├── jest-{unit,integration,e2e}.json
│   └── unit/                    # 18 specs, 109 tests verdes
│       ├── shared/domain/       # Result, ValueObject, Specification, AggregateRoot, EventBus
│       ├── modules/auth/        # Email, Password, User aggregate, RefreshToken, OneTimeToken, 4 use cases
│       └── modules/rbac/        # Role, AssignRole, buildAbility, AbilityCacheStore
│
├── scripts/
│   ├── deploy.sh                # env-agnostic skeleton (k8s/ECS): migrate → rollout → smoke → auto-rollback
│   ├── smoke.sh                 # curl 5 endpoints críticos
│   ├── smoke.k6.js              # 100 RPS / 1min / p95<500ms p99<1.5s errors<1%
│   └── init-project.mjs         # rename package + regen COOKIE_SECRET + RSA keypair en .env
│
├── .github/workflows/ci.yml     # lint+typecheck, unit, integration (postgres+redis services), build, audit, scan (Trivy), migration-lint (squawk)
├── docker-compose.yml           # postgres:17-alpine + redis:7-alpine + api con healthchecks
├── Dockerfile                   # multi-stage Node 24 alpine + non-root + tini + HEALTHCHECK
├── eslint.config.mjs            # flat config + typescript-eslint + prettier + boundaries (capas hexagonales)
├── tsconfig.json                # strict + noUncheckedIndexedAccess
├── tsconfig.build.json          # rootDir: ./src → dist/main.js plano
├── .env.example                 # ~25 envvars con defaults seguros
├── .husky/                      # pre-commit (lint-staged) + commit-msg (commitlint Conventional)
├── README.md                    # quickstart + endpoints + comandos
├── CONTRIBUTING.md              # convenciones + checklist PR
├── LICENSE                      # MIT
└── CLAUDE.md                    # guía para Claude Code (refleja estado actual)
```

---

## 6. Endpoints (todos bajo `/api`)

Swagger en `/api/docs`. URI versioning con default `v1`.

### Auth (públicos)

| Método | Ruta                           | Throttle   | Descripción                                  |
| ------ | ------------------------------ | ---------- | -------------------------------------------- |
| POST   | `/auth/register`               | 5/h IP     | Registro + auto-emit verify email            |
| POST   | `/auth/login`                  | 5/10min IP | Constant-time. Lockout tras 5 fallos = 15min |
| POST   | `/auth/refresh`                | 30/min     | Rotation + theft detection                   |
| POST   | `/auth/logout`                 | —          | Idempotente (204)                            |
| GET    | `/auth/email/verify?token=X`   | 30/min     | Marca emailVerifiedAt                        |
| POST   | `/auth/email/verify/resend`    | 1/min      | Anti-enumeration (siempre 202)               |
| POST   | `/auth/password-reset/request` | 5/10min    | Anti-enumeration (siempre 202)               |
| POST   | `/auth/password-reset/confirm` | 5/10min    | Revoca **todas** las sesiones del user       |
| GET    | `/auth/google`                 | —          | Issue state CSRF + redirect                  |
| GET    | `/auth/google/callback`        | —          | Consume state + use case                     |
| GET    | `/auth/github`                 | —          | Issue state CSRF + redirect                  |
| GET    | `/auth/github/callback`        | —          | Consume state + use case                     |

### Auth (protegidos JWT)

| Método | Ruta                      | Permiso CASL                                 | Descripción                             |
| ------ | ------------------------- | -------------------------------------------- | --------------------------------------- |
| POST   | `/auth/logout-all`        | — (solo JWT)                                 | Stub — clearCookie                      |
| POST   | `/admin/users/:id/unlock` | `unlock:User` ∨ `manage:User` ∨ `manage:all` | Reset failedLoginAttempts + lockedUntil |

### RBAC (protegidos JWT + PoliciesGuard)

| Método | Ruta                          | Permiso                      |
| ------ | ----------------------------- | ---------------------------- |
| GET    | `/rbac/roles`                 | `read:Role`                  |
| GET    | `/rbac/permissions`           | `read:Permission`            |
| POST   | `/rbac/users/:id/roles`       | `update:User` ∨ `manage:all` |
| DELETE | `/rbac/users/:id/roles/:name` | `update:User` ∨ `manage:all` |

### Health

| Método | Ruta            | Notas                                                                       |
| ------ | --------------- | --------------------------------------------------------------------------- |
| GET    | `/health/live`  | No toca deps; 200 si proceso vivo                                           |
| GET    | `/health/ready` | DB + Redis (si REDIS_REQUIRED=true) + version + uptime; 503 si alguno falla |

---

## 7. Comandos comunes

```sh
# Dev day-to-day
pnpm start:dev                 # watch
pnpm typecheck && pnpm lint    # antes de commit
pnpm test:unit                 # 98-109 tests, ~3s

# DB
pnpm db:migrate:dev            # crea migration desde diff
pnpm db:migrate:deploy         # CI/prod: aplica pendientes
pnpm db:seed                   # roles + permisos sistema (idempotente)
pnpm db:reset                  # ⚠️ solo dev

# Docker stack completo
pnpm compose:up                # postgres + redis + api
pnpm compose:down              # con -v

# Build
pnpm build                     # → dist/main.js (NO dist/src/main.js)

# Templating (proyecto nuevo)
node scripts/init-project.mjs <new-project-name>

# Smoke post-deploy
./scripts/smoke.sh https://staging.example.com
BASE_URL=https://staging.example.com k6 run scripts/smoke.k6.js
```

Ver más en [`README.md`](../README.md) sección "Comandos".

---

## 8. Convenciones críticas (gotchas)

Cosas que un agente nuevo **debe** saber para no romper invariantes:

1. **Domain layer NO importa NestJS ni Prisma.** ESLint lo rechaza. Si necesitas servicios, defínelos como ports en `domain/ports/` y bindea en el module.

2. **Errores de dominio son valores, no excepciones.** Use cases retornan `Promise<Result<T, DomainError>>`. Solo el controller hace `throw result.error` para que el `GlobalExceptionFilter` mapee a HTTP. Excepciones reales = infra failures (DB caída, etc.).

3. **Prisma 7 ESM/cjs**: el `generator client` tiene `moduleFormat = "cjs"` forzado. Si lo quitas, NestJS rompe.

4. **`url` de Prisma vive en `prisma.config.ts`**, NO en `schema.prisma` (cambio de Prisma 7). El CLI carga ese archivo automáticamente.

5. **Build output flat**: `tsconfig.build.json` con `rootDir: ./src` produce `dist/main.js` directo (no `dist/src/main.js`). El Dockerfile y `start:prod` dependen de eso.

6. **OTel debe importarse antes que TODO**: `import './otel';` es la primera línea de `main.ts`. Si lo movés, las auto-instrumentations no enganchan.

7. **Refresh cookie path es `/api/auth`** — el browser solo la manda a endpoints de auth. Defense-in-depth además de `SameSite=Strict`.

8. **Refresh token raw NUNCA se persiste** — solo el sha256 hash. Para validar, hashas el incoming y haces `findByHash`.

9. **Reuso de refresh revocado = revocar TODA la familia** + emitir `RefreshTokenReuseDetected` (severity high). Esto es theft detection.

10. **JWT keys ephemerales en dev**: si no hay `JWT_PRIVATE_KEY/PUBLIC_KEY` y `NODE_ENV=dev|test`, `JwtSigner` genera un keypair RSA al boot. Tokens invalidan en cada restart. En prod los keys son obligatorios o lanza error.

11. **Anti email-enumeration**: register / password-reset request / resend-verification responden siempre 200/202 idéntico independientemente de si el email existe. No abrir excepciones a esto.

12. **Login constant-time**: si el user no existe, hashear un dummy igual antes de responder, para que el tiempo no leak existencia.

13. **CASL conditions con `$user.id`** se resuelven en `buildAbility`. Si agregas más placeholders (`$tenant.id`, etc.), agregar el case en `resolvePlaceholder` de `app-ability.ts`.

14. **Cache de abilities con generation counter**: cualquier cambio en roles/permisos llama `cache.publishInvalidation()` → `INCR rbac:abilities:gen` + `PUBLISH`. NO usar SCAN/DEL para invalidar — las keys L2 viejas expiran solas (TTL 10min).

15. **Una migration por PR** + cada migration con `down.sql` adyacente. CI corre `squawk` y rechaza patterns peligrosos (`ALTER ... NOT NULL DEFAULT '...'`, `RENAME COLUMN`, `DROP COLUMN`).

16. **Logs**: pino redacta `authorization`, `cookie`, `password*`, `set-cookie` automáticamente. Nunca loggear tokens raw, hashes, ni PII identificable.

17. **Throttler con Redis**: `ThrottlerModule.forRootAsync` usa `ThrottlerStorageRedisService` cuando `REDIS_URL` está seteado. Sin Redis cae a in-memory (single-pod). Multi-pod requiere Redis sí o sí.

18. **Tests integration y E2E requieren Docker** corriendo (Testcontainers). En entorno sin Docker (este sandbox) solo unit pasa.

---

## 9. Tests

```
test/unit/
├── shared/domain/                       # 24 tests (Result, ValueObject, Specification, AggregateRoot, EventBus)
├── modules/auth/
│   ├── domain/                          # Email, Password, User aggregate (lockout policy), RefreshToken, OneTimeToken
│   └── application/                     # VerifyEmail, ResetPassword, RequestPasswordReset, HandleOAuthCallback
├── modules/rbac/
│   ├── domain/                          # Role
│   ├── application/                     # AssignRole
│   └── infrastructure/                  # buildAbility, AbilityCacheStore
```

**109 tests verdes en 18 suites**, ~3s.

Coverage:

- Domain layer: 90%+ (Result/Specification/EventBus 100%)
- Application use cases: cubren happy + cada `Result.Err`
- Adapters Prisma/Redis/Argon: TBD integration tests con Testcontainers (necesita Docker)

Ver [`testing/01-strategy.md`](./testing/01-strategy.md) para política de pirámide y umbrales.

---

## 10. Arquitectura por bounded context

Cada módulo dentro de `src/modules/<context>/` tiene:

```
domain/                     # puro: cero NestJS, cero Prisma
├── entities/               # AggregateRoot + Entity
├── value-objects/          # constructor privado, equality por valor
├── events/                 # extends BaseDomainEvent
├── ports/                  # interfaces que el dominio necesita
└── errors/                 # extends DomainError jerarquía

application/                # orquestación
├── use-cases/              # uno por archivo, retornan Result
└── (ports adicionales si aplica, ej. HASHER en auth)

infrastructure/             # adapters
├── persistence/            # PrismaXxxRepository + mappers
├── crypto/ | mailer/ | oauth/

presentation/               # driving adapters
├── controllers/
├── dtos/                   # class-validator + Swagger
├── guards/                 # JwtAuthGuard, PoliciesGuard
└── strategies/             # Passport (jwt, google, github)

<context>.module.ts         # cablea ports → adapters via DI symbols
```

**Regla cross-bounded-context**: prohibido importar entre módulos directamente. Solo via re-exports explícitos del module (`RbacModule` exporta `PoliciesGuard` + `ABILITY_FACTORY` para que `AuthModule` arme `AdminController`).

---

## 11. Observabilidad

**Logs**: `nestjs-pino` JSON estructurado. Cada request lleva `requestId` (uuid v7) y `traceId` (de OTel) automáticamente. Redact paths configurados para PII / secrets.

**Traces**: NodeSDK + `@opentelemetry/auto-instrumentations-node` cubre HTTP server/client, Express, Prisma, Redis, fetch/axios. Activación: solo si `OTEL_EXPORTER_OTLP_ENDPOINT` está seteado. Endpoint `/v1/traces`.

**Metrics**: histograms de latencia + counters automáticos por las instrumentations. Endpoint `/v1/metrics`. Export interval 10s.

**Health**: `/api/health/live` (no toca deps) + `/api/health/ready` (DB + Redis + version + uptime).

**Cache de abilities** (M4 perf):

- L1 LRU in-memory: 1 min TTL, 1000 entries max
- L2 Redis: 10 min TTL, key con gen suffix
- Invalidación cross-pod via `INCR rbac:abilities:gen` + `PUBLISH rbac:abilities:invalidated`

**Compression**: gzip/br para responses >1KB (skip via `x-no-compression` header).

---

## 12. Seguridad — checklist en código

- [x] Argon2id para passwords (M=64MB, t=3, p=1)
- [x] JWT RS256 (no HS256)
- [x] Refresh token opaque + sha256 hash en DB + rotation + theft detection
- [x] Cookies signed + HttpOnly + Secure (prod) + SameSite=Strict + Path scoped
- [x] Helmet con HSTS + CSP off (Swagger; harden per-route en M6+)
- [x] CORS lista blanca explícita (no `*` con credentials)
- [x] Throttler granular por endpoint sensible
- [x] OAuth state CSRF (Redis 10min single-use)
- [x] Anti email-enumeration en 3 endpoints
- [x] Login constant-time
- [x] Logs con redact PII automático
- [x] CASL para object-level authorization (no IDOR)
- [x] Joi env schema falla rápido en boot
- [x] Trivy fs scan en CI
- [x] pnpm audit --audit-level high en CI
- [x] squawk migration linter en CI
- [ ] Penetration test (operativo, fuera de repo)
- [ ] WAF / DDoS mitigation (capa de infra, fuera de repo)

Ver [`architecture/cross-cutting/security.md`](./architecture/cross-cutting/security.md) para detalle OWASP Top 10.

---

## 13. Pendientes reales

**Necesitan Docker corriendo (E2E real)**:

- M3 E2E con Testcontainers + supertest sobre features Gherkin de auth
- M4 E2E con `accessibleBy(ability)` aplicado en listings reales
- M5 E2E con `nock` mockeando Google/GitHub

**Operativos (fuera de repo)**:

- Marcar repo como GitHub template (Settings)
- Aprobación manual de prod en GitHub Environments
- Runbook de migration ensayado en staging

**Mejoras opcionales (no críticas)**:

- CRUD completo de roles (create/update/delete con validación de protected roles)
- Reverse index userId↔roleId para invalidación granular del cache (actualmente global)
- ETag en endpoints GET con caching headers
- Sentry integration (opcional, complementa OTel)
- WebAuthn / passkeys (si aparece el caso de uso)

---

## 14. Punteros rápidos

| Necesitas…                     | Mira…                                                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Estado al día por turno        | [`PROGRESS.md`](./PROGRESS.md)                                                                                                          |
| Quickstart 5 min               | [`../README.md`](../README.md)                                                                                                          |
| Convenciones / cómo contribuir | [`../CONTRIBUTING.md`](../CONTRIBUTING.md)                                                                                              |
| Decisiones arquitecturales     | [`planning/decisions/ADR-*`](./planning/decisions/)                                                                                     |
| Reglas de migration            | [`database/02-migration-strategy.md`](./database/02-migration-strategy.md)                                                              |
| Runbook si algo rompe          | [`prod/04-incident-runbook.md`](./prod/04-incident-runbook.md) + [`database/03-rollback-runbook.md`](./database/03-rollback-runbook.md) |
| Checklist pre-prod             | [`prod/05-readiness-checklist.md`](./prod/05-readiness-checklist.md)                                                                    |
| Cómo testear                   | [`testing/01-strategy.md`](./testing/01-strategy.md) + [`testing/02-testcontainers-setup.md`](./testing/02-testcontainers-setup.md)     |
| Reglas de capas hexagonal      | [`architecture/03-folder-layout.md`](./architecture/03-folder-layout.md) (con config ESLint)                                            |
| Specs Gherkin (BDD)            | [`features/`](./features/) — 19 archivos / 80 scenarios                                                                                 |
| Hooks Claude Code              | [`../CLAUDE.md`](../CLAUDE.md)                                                                                                          |

---

## 15. Cómo arrancar una sesión nueva

1. **Lee este archivo** (`AGENTS/GLOBAL.md`) — punto de partida.
2. Si la tarea es operativa o pequeña: vé directo a editar lo que toque.
3. Si la tarea cruza bounded contexts: revisa los ADRs relevantes en `planning/decisions/`.
4. Si vas a tocar migrations: lee `database/02-migration-strategy.md` y `03-rollback-runbook.md`.
5. Si vas a tocar auth/RBAC: revisa los Gherkin features correspondientes en `features/auth/` y `features/rbac/`.
6. Antes de commitear: `pnpm typecheck && pnpm lint && pnpm test:unit` deben estar verdes.
7. Conventional Commits validados por hook.
8. Actualiza este `GLOBAL.md` solo cuando cambien decisiones de alto nivel; el día a día va en `PROGRESS.md`.
