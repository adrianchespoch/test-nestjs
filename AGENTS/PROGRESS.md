# PROGRESS

> Source of truth del avance del skeleton. Actualizar al cerrar cada item.
> Estado actual y next steps siempre visibles aquí.

**Updated**: 2026-05-03

## Leyenda

- `[ ]` pendiente
- `[~]` en progreso
- `[x]` hecho
- `[!]` bloqueado / requiere decisión

## Estado global

| Milestone                                    | Estado | Notas                                                                                                                                                                                                                                                                 |
| -------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M0** — Documentation                       | `[x]`  | AGENTS/ completo: 35 .md + 19 .feature (80 scenarios)                                                                                                                                                                                                                 |
| **M1** — Bootstrap & infra                   | `[x]`  | Cerrado salvo `src/otel.ts` (deferred a M6) y docker smoke (sin docker en este entorno)                                                                                                                                                                               |
| **M2** — Domain kernel (DDD building blocks) | `[x]`  | Result, Entity, AggregateRoot, ValueObject, DomainEvent, Specification, ports, GlobalExceptionFilter, SystemClock, InMemoryEventBus + 24 tests verdes                                                                                                                 |
| **M3** — Auth: email/password local          | `[x]`  | Cerrado: 9 use cases (incluye admin-unlock vía RBAC), todos los endpoints cableados. Falta solo E2E con Postgres real                                                                                                                                                 |
| **M4** — RBAC con CASL                       | `[x]`  | Cerrado: Domain + 4 use cases + AbilityFactory CASL + PoliciesGuard + RolesController + AdminController + **two-tier cache (LRU L1 + Redis L2) con pub/sub gen-counter invalidation**. 109 tests verdes. CRUD completo de roles + E2E pendientes pero no son hot path |
| **M5** — OAuth2 social (Google + GitHub)     | `[~]`  | Use case + strategies + controller con state CSRF Redis. 6 escenarios (first-login crea user passwordless+verified, login con link existente, conflict sin auth, link match, mismatch conflict, unverified email reject). 98 tests. Falta E2E                         |
| **M6** — Hardening prod                      | `[~]`  | OTel SDK init + Throttler Redis storage + squawk en CI + deploy.sh + smoke.sh + smoke.k6.js + **abilities cache two-tier + compression middleware**. Falta: runbook ensayado en staging (operativo)                                                                   |
| **M7** — Templating                          | `[~]`  | README quickstart + CONTRIBUTING + LICENSE MIT + `scripts/init-project.mjs` (rename + regen secrets). CLAUDE.md actualizado al estado real. Falta: marcar repo como GitHub template (config en GitHub)                                                                |

## Cómo usar este archivo

- Cada PR que completa un item marca `[ ]` → `[x]` aquí en el mismo PR.
- Al empezar un item, marcar `[~]` con el nombre/handle del autor: `[~]@adrian`.
- Si un item se bloquea, escribir `[!]` + razón en una línea siguiente.

---

## M0 — Documentation `[x]` ✅

| Item                                                  | Path                                                                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `[x]` README index                                    | [`README.md`](./README.md)                                                                                               |
| `[x]` Context                                         | [`planning/00-context.md`](./planning/00-context.md)                                                                     |
| `[x]` Stack & versions LTS                            | [`planning/01-stack-versions.md`](./planning/01-stack-versions.md)                                                       |
| `[x]` Roadmap (M1..M7)                                | [`planning/02-roadmap.md`](./planning/02-roadmap.md)                                                                     |
| `[x]` ADR-001 Prisma vs TypeORM                       | [`planning/decisions/ADR-001-prisma-vs-typeorm.md`](./planning/decisions/ADR-001-prisma-vs-typeorm.md)                   |
| `[x]` ADR-002 Hexagonal + DDD                         | [`planning/decisions/ADR-002-hexagonal-with-ddd.md`](./planning/decisions/ADR-002-hexagonal-with-ddd.md)                 |
| `[x]` ADR-003 argon2id                                | [`planning/decisions/ADR-003-argon2id-password-hashing.md`](./planning/decisions/ADR-003-argon2id-password-hashing.md)   |
| `[x]` ADR-004 JWT cookie delivery                     | [`planning/decisions/ADR-004-jwt-cookie-delivery.md`](./planning/decisions/ADR-004-jwt-cookie-delivery.md)               |
| `[x]` ADR-005 CASL RBAC + ABAC                        | [`planning/decisions/ADR-005-casl-rbac-abac.md`](./planning/decisions/ADR-005-casl-rbac-abac.md)                         |
| `[x]` ADR-006 pino + OTel                             | [`planning/decisions/ADR-006-pino-otel-observability.md`](./planning/decisions/ADR-006-pino-otel-observability.md)       |
| `[x]` ADR-007 expand-contract migrations              | [`planning/decisions/ADR-007-expand-contract-migrations.md`](./planning/decisions/ADR-007-expand-contract-migrations.md) |
| `[x]` ADR-008 DI con contenedor NestJS en application | [`planning/decisions/ADR-008-di-with-nestjs-container.md`](./planning/decisions/ADR-008-di-with-nestjs-container.md)     |
| `[x]` Hexagonal overview                              | [`architecture/01-hexagonal-overview.md`](./architecture/01-hexagonal-overview.md)                                       |
| `[x]` DDD building blocks                             | [`architecture/02-ddd-building-blocks.md`](./architecture/02-ddd-building-blocks.md)                                     |
| `[x]` Folder layout                                   | [`architecture/03-folder-layout.md`](./architecture/03-folder-layout.md)                                                 |
| `[x]` SOLID applied                                   | [`architecture/04-solid-applied.md`](./architecture/04-solid-applied.md)                                                 |
| `[x]` Design patterns catalog                         | [`architecture/05-design-patterns-catalog.md`](./architecture/05-design-patterns-catalog.md)                             |
| `[x]` Cross-cutting · validation                      | [`architecture/cross-cutting/validation.md`](./architecture/cross-cutting/validation.md)                                 |
| `[x]` Cross-cutting · error-handling                  | [`architecture/cross-cutting/error-handling.md`](./architecture/cross-cutting/error-handling.md)                         |
| `[x]` Cross-cutting · logging                         | [`architecture/cross-cutting/logging.md`](./architecture/cross-cutting/logging.md)                                       |
| `[x]` Cross-cutting · observability                   | [`architecture/cross-cutting/observability.md`](./architecture/cross-cutting/observability.md)                           |
| `[x]` Cross-cutting · security                        | [`architecture/cross-cutting/security.md`](./architecture/cross-cutting/security.md)                                     |
| `[x]` Cross-cutting · caching                         | [`architecture/cross-cutting/caching.md`](./architecture/cross-cutting/caching.md)                                       |
| `[x]` DB · Prisma setup                               | [`database/01-prisma-setup.md`](./database/01-prisma-setup.md)                                                           |
| `[x]` DB · Migration strategy                         | [`database/02-migration-strategy.md`](./database/02-migration-strategy.md)                                               |
| `[x]` DB · Rollback runbook                           | [`database/03-rollback-runbook.md`](./database/03-rollback-runbook.md)                                                   |
| `[x]` DB · Seed strategy                              | [`database/04-seed-strategy.md`](./database/04-seed-strategy.md)                                                         |
| `[x]` Testing · strategy                              | [`testing/01-strategy.md`](./testing/01-strategy.md)                                                                     |
| `[x]` Testing · Testcontainers                        | [`testing/02-testcontainers-setup.md`](./testing/02-testcontainers-setup.md)                                             |
| `[x]` Testing · fixtures                              | [`testing/03-fixtures-and-factories.md`](./testing/03-fixtures-and-factories.md)                                         |
| `[x]` Testing · coverage                              | [`testing/04-coverage-policy.md`](./testing/04-coverage-policy.md)                                                       |
| `[x]` Prod · config & secrets                         | [`prod/01-config-secrets.md`](./prod/01-config-secrets.md)                                                               |
| `[x]` Prod · Docker                                   | [`prod/02-docker-prod.md`](./prod/02-docker-prod.md)                                                                     |
| `[x]` Prod · CI/CD                                    | [`prod/03-ci-cd-pipeline.md`](./prod/03-ci-cd-pipeline.md)                                                               |
| `[x]` Prod · incident runbook                         | [`prod/04-incident-runbook.md`](./prod/04-incident-runbook.md)                                                           |
| `[x]` Prod · readiness checklist                      | [`prod/05-readiness-checklist.md`](./prod/05-readiness-checklist.md)                                                     |

---

## M1 — Bootstrap & infra base `[~]`

| #     | Item                                                                                                                                                   | Estado                                                        |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| M1.1  | `package.json` con stack pinneado (NestJS 11 + Prisma 7 + helmet + throttler + pino)                                                                   | `[x]`                                                         |
| M1.2  | `tsconfig.json` strict + `tsconfig.build.json` con `rootDir: src`                                                                                      | `[x]`                                                         |
| M1.3  | `eslint.config.mjs` flat + `eslint-plugin-boundaries`                                                                                                  | `[x]`                                                         |
| M1.4  | `.prettierrc` + `.editorconfig` + `.nvmrc`                                                                                                             | `[x]`                                                         |
| M1.5  | Husky + lint-staged + commitlint (Conventional Commits)                                                                                                | `[x]`                                                         |
| M1.6  | `.env.example` + `src/config/env.schema.ts` (Joi)                                                                                                      | `[x]`                                                         |
| M1.7  | `docker-compose.yml` (postgres:17 + redis:7-alpine + api)                                                                                              | `[x]`                                                         |
| M1.8  | `Dockerfile` multi-stage Node 24 + non-root + tini                                                                                                     | `[x]`                                                         |
| M1.9  | `prisma/schema.prisma` con todo el modelo (User, Role, Permission, Session, RefreshToken, AccountProvider, OneTimeToken) + `prisma.config.ts`          | `[x]`                                                         |
| M1.10 | `prisma/seed.ts` (system roles + permissions)                                                                                                          | `[x]`                                                         |
| M1.11 | `src/otel.ts` (init OTel SDK)                                                                                                                          | `[ ]` deferred a M6 hardening                                 |
| M1.12 | `src/main.ts` (helmet + ValidationPipe + Swagger + cookie-parser + URI versioning)                                                                     | `[x]`                                                         |
| M1.13 | `src/app.module.ts` (Config + Pino + Throttler + Prisma + Redis + Health)                                                                              | `[x]`                                                         |
| M1.14 | `src/shared/infrastructure/prisma/{prisma.module.ts,prisma.service.ts}`                                                                                | `[x]`                                                         |
| M1.15 | `src/shared/infrastructure/redis/{redis.module.ts,redis.service.ts}`                                                                                   | `[x]`                                                         |
| M1.16 | `src/shared/presentation/interceptors/correlation-id.interceptor.ts`                                                                                   | `[x]`                                                         |
| M1.17 | `src/modules/health/` con `@nestjs/terminus` (live + ready + readiness metadata)                                                                       | `[x]`                                                         |
| M1.18 | Borrar legacy: `src/users/`, `src/tasks/`, `src/redis/`, `src/common/`, `src/health/`, `src/config/{app,typeorm}.*`, `src/migrations/*.ts`, `scripts/` | `[x]`                                                         |
| M1.19 | `.github/workflows/ci.yml` (lint + typecheck + unit + integration + build + audit + Trivy scan)                                                        | `[x]`                                                         |
| M1.20 | `pnpm install` + `pnpm prisma generate` + `pnpm typecheck` + `pnpm build` + `pnpm lint:check` verdes                                                   | `[x]`                                                         |
| M1.21 | `docker compose up -d --build` smoke (`/api/health/ready` → 200)                                                                                       | `[ ]` (entorno actual sin docker; pendiente de validar local) |

**Definition of Done**: app levanta contra Postgres+Redis vía docker-compose, `/api/docs` carga, logs JSON con traceId.

---

## M2 — Domain kernel `[x]`

| Item                                                         | Estado | Path                                                                      |
| ------------------------------------------------------------ | ------ | ------------------------------------------------------------------------- |
| `Result<T, E>` + `DomainError` jerarquía                     | `[x]`  | `src/shared/domain/result.ts`, `src/shared/domain/errors/domain.error.ts` |
| `Entity<TId>` base                                           | `[x]`  | `src/shared/domain/entity.ts`                                             |
| `AggregateRoot<TId>` con `pullEvents`                        | `[x]`  | `src/shared/domain/aggregate-root.ts`                                     |
| `ValueObject<Props>` con equality + frozen props             | `[x]`  | `src/shared/domain/value-object.ts`                                       |
| `DomainEvent` + `BaseDomainEvent`                            | `[x]`  | `src/shared/domain/domain-event.ts`                                       |
| `Specification<T>` con `and/or/not`                          | `[x]`  | `src/shared/domain/specification.ts`                                      |
| `IClock` port                                                | `[x]`  | `src/shared/application/ports/clock.port.ts`                              |
| `IEventBus` port                                             | `[x]`  | `src/shared/application/ports/event-bus.port.ts`                          |
| `IUnitOfWork` port                                           | `[x]`  | `src/shared/application/ports/unit-of-work.port.ts`                       |
| `UseCase<I, O>` base                                         | `[x]`  | `src/shared/application/use-case.ts`                                      |
| `GlobalExceptionFilter` (Domain/HttpException/Prisma → HTTP) | `[x]`  | `src/shared/application/filters/global-exception.filter.ts`               |
| `CorrelationIdInterceptor`                                   | `[x]`  | `src/shared/presentation/interceptors/correlation-id.interceptor.ts`      |
| `SystemClock` adapter                                        | `[x]`  | `src/shared/infrastructure/clock/system-clock.ts`                         |
| `InMemoryEventBus` adapter                                   | `[x]`  | `src/shared/infrastructure/event-bus/in-memory-event-bus.ts`              |
| `SharedModule` (@Global) cablea CLOCK + EVENT_BUS            | `[x]`  | `src/shared/shared.module.ts`                                             |
| `PrismaUnitOfWork` adapter                                   | `[ ]`  | deferred a M3 (cuando aparezca el primer use case que lo necesite)        |
| Unit tests del kernel (24 tests verdes)                      | `[x]`  | `test/unit/shared/domain/`                                                |

---

## M3 — Auth: email/password local `[~]` (~95%)

| Feature                                  | Scenarios | Estado                                                                   | Spec                                                                                     |
| ---------------------------------------- | --------: | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Registration                             |         6 | `[~]` use case + endpoint + auto-emit verify token. Falta E2E            | [`features/auth/registration.feature`](./features/auth/registration.feature)             |
| Login                                    |         6 | `[~]` use case + endpoint (constant-time, lockout). Falta E2E            | [`features/auth/login.feature`](./features/auth/login.feature)                           |
| Refresh token rotation + theft detection |         5 | `[~]` use case + endpoint (rotation + revoke family). Falta E2E          | [`features/auth/refresh-token.feature`](./features/auth/refresh-token.feature)           |
| Logout                                   |         3 | `[~]` use case + endpoint idempotente. Falta E2E                         | [`features/auth/logout.feature`](./features/auth/logout.feature)                         |
| Password reset                           |         4 | `[~]` request (no leak) + confirm (revoca todas las sesiones). Falta E2E | [`features/auth/password-reset.feature`](./features/auth/password-reset.feature)         |
| Email verification                       |         3 | `[~]` GET verify + POST resend (1/min). Falta E2E                        | [`features/auth/email-verification.feature`](./features/auth/email-verification.feature) |
| Account lockout                          |         3 | `[~]` policy en User aggregate. Falta admin unlock (post-RBAC)           | [`features/auth/account-lockout.feature`](./features/auth/account-lockout.feature)       |

**Sub-tasks de implementación M3:**

- `[x]` Migración inicial `prisma/migrations/20260503000000_init/` (185 líneas SQL + down.sql + lock.toml)
- `[x]` VOs: `Email`, `Password`, `HashedPassword`, `UserId`, `SessionId`, `RefreshTokenId`, `OneTimeTokenId`
- `[x]` Aggregates/Entities: `User` (lockout policy, change pwd, unlock), `Session`, `RefreshToken` (revoke + flagReuse), `OneTimeToken` (TTL por purpose)
- `[x]` 7 Domain events + 11 errores tipados (incluyendo `VerificationTokenInvalidError`, `ResetTokenInvalidError`)
- `[x]` 8 ports: `IUserRepository`, `ISessionRepository`, `IRefreshTokenRepository`, `IOneTimeTokenRepository`, `IHasher`, `IJwtSigner`, `IEmailSender`, `IRefreshTokenGenerator`, `IOneTimeTokenGenerator`
- `[x]` 8 use cases: `RegisterUser` (auto-emit verify), `Login`, `RefreshToken`, `Logout`, `VerifyEmail`, `ResendVerification` (no leak), `RequestPasswordReset` (no leak), `ResetPassword` (revoca sesiones)
- `[x]` Adapters: `ArgonHasher`, `JwtSigner` RS256 con dev fallback, `RefreshTokenGenerator` + `OneTimeTokenGenerator` (sha256), 4 Prisma repos, `ConsoleMailer` dev
- `[x]` Controllers + DTOs + `JwtAuthGuard` + `JwtStrategy` (RS256) + `@CurrentUser` + Swagger docs
- `[x]` Throttler config: register 5/h, login 5/10min, refresh 30/min, resend 1/min, password-reset 5/10min
- `[x]` Refresh cookie con `HttpOnly` + `Secure` (prod) + `SameSite=Strict` + `Path=/api/auth` + `signed`
- `[x]` `AuthModule` cableado + agregado a `AppModule`
- `[x]` Unit tests: **55 tests auth** (Email, Password, User aggregate con 5 escenarios lockout, RefreshToken, OneTimeToken, VerifyEmail UC, ResetPassword UC con sesion revocation, RequestPasswordReset UC con anti-enumeration)
- `[ ]` Admin unlock endpoint (depende de RBAC — M4)
- `[ ]` E2E con Testcontainers + supertest

---

## M4 — RBAC con CASL `[~]` (~70%)

| Feature                | Scenarios | Estado                                                                                                                                                     | Spec                                                                                             |
| ---------------------- | --------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Roles management       |         4 | `[~]` assign/remove/list cableados; falta CRUD completo (create/update/delete)                                                                             | [`features/rbac/roles-management.feature`](./features/rbac/roles-management.feature)             |
| Permissions management |         3 | `[~]` list cableado, condiciones ABAC con `$user.id` resolver                                                                                              | [`features/rbac/permissions-management.feature`](./features/rbac/permissions-management.feature) |
| Authorization checks   |         6 | `[~]` PoliciesGuard + @CheckPolicies funcionando con AppAbility (manage:all wildcard, ABAC conditions); falta `accessibleBy(ability)` para query filtering | [`features/rbac/authorization-checks.feature`](./features/rbac/authorization-checks.feature)     |

**Sub-tasks de implementación M4:**

- `[x]` Domain: `Role` aggregate (replacePermissions con event, system role inmutable), `Permission` entity, `RoleId`/`PermissionId`/`PermissionKey` VOs, 3 events, 6 errors tipados
- `[x]` Ports: `IRoleRepository`, `IPermissionRepository`, `IUserRoleRepository`, `IAbilityFactory`
- `[x]` Adapters Prisma: `PrismaRoleRepository` (con replace permissions tx), `PrismaPermissionRepository` (con `findEffectiveForUser` que devuelve permisos deduplicados), `PrismaUserRoleRepository` (assign/remove/rolesOfUser idempotentes)
- `[x]` `CaslAbilityFactory` con `buildAbility` que resuelve placeholders `$user.id` en conditions
- `[x]` `AppAbility` types (`MongoAbility<[Action, Subject]>`) con acciones canónicas
- `[x]` `PoliciesGuard` (Reflector + CHECK_POLICIES_KEY) + `@CheckPolicies(...)` decorator
- `[x]` Use cases: `AssignRoleUseCase`, `RemoveRoleUseCase`, `ListRolesUseCase`, `ListPermissionsUseCase`
- `[x]` `AdminUnlockUserUseCase` (auth) + `AdminController` con guard `unlock:User OR manage:User OR manage:all`
- `[x]` `RolesController` con 4 endpoints protegidos (read:Role / read:Permission / update:User OR manage:all)
- `[x]` `RbacModule` cableado, exporta `PoliciesGuard` + `ABILITY_FACTORY`; importado por `AuthModule` para `AdminController`
- `[x]` Unit tests: **13 tests RBAC** (`buildAbility` con manage:all wildcard / action-specific / ABAC conditions / unlock no implies manage; `Role` aggregate con name validation, replace permissions event-emit, system role inmutable; `AssignRoleUseCase` happy + role not found)
- `[x]` **Cache abilities two-tier (L1 LRU 1min + L2 Redis 10min)** con `AbilityCacheStore`. Invalidación cross-pod O(1) vía gen-counter (`INCR rbac:abilities:gen` + `PUBLISH rbac:abilities:invalidated`); pods suscritos clearan L1; keys L2 viejas quedan huérfanas y expiran solas (no hace falta SCAN/DEL). Fallback local-only si Redis cae
- `[ ]` CRUD completo: create/update/delete roles (queda como tarea concreta cuando aparezca el caso de uso)
- `[ ]` `accessibleBy(ability)` aplicado en listings de otros bounded contexts (depende de cuándo aparezcan)
- `[ ]` E2E test por feature Gherkin

**Sub-tasks:**

- `[ ]` `Role`, `Permission` entities + `RoleAssigned`, `PermissionGranted` events
- `[ ]` `AbilityFactory` + cache Redis con pub/sub invalidation
- `[ ]` `PoliciesGuard` + `@CheckPolicies` decorator
- `[ ]` `accessibleBy(ability)` aplicado en listings (filtrado SQL)
- `[ ]` Endpoints CRUD roles/permissions protegidos por sí mismos
- `[ ]` E2E tests + ABAC condicional verificado

---

## M5 — OAuth2 social (Google + GitHub) `[~]` (~85%)

| Feature      | Scenarios | Estado                                                                           | Spec                                                                         |
| ------------ | --------: | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| OAuth Google |         5 | `[~]` strategy + state CSRF + use case con first-login/link/conflict; falta E2E  | [`features/auth/oauth-google.feature`](./features/auth/oauth-google.feature) |
| OAuth GitHub |         4 | `[~]` strategy + state CSRF (passport-github2 con scope `user:email`); falta E2E | [`features/auth/oauth-github.feature`](./features/auth/oauth-github.feature) |

**Sub-tasks:**

- `[x]` Domain: `OAuthProfile` VO, `AccountProvider` entity (link a User), 2 events (`OAuthAccountCreated`, `OAuthAccountLinked`), 3 errores (`AccountLinkRequiredError`, `OAuthStateMismatchError`, `OAuthMissingEmailError`)
- `[x]` `User.registerViaOAuth` factory (passwordHash null, emailVerifiedAt=now)
- `[x]` Ports: `IAccountProviderRepository`, `IOAuthStateStore`
- `[x]` `RedisOAuthStateStore` con state aleatorio 32B base64url + TTL 10min + fallback in-memory
- `[x]` `PrismaAccountProviderRepository` con unique `(provider, providerAccountId)`
- `[x]` `HandleOAuthCallbackUseCase` con 4 ramas: existing link → login / authenticated linker matches → link / authenticated linker mismatches → conflict / no email match → create new user. Crea Session + RefreshToken + access JWT igual que login normal
- `[x]` Strategies Passport: `GoogleStrategy` (passport-google-oauth20) + `GithubStrategy` (passport-github2)
- `[x]` `OAuthController` con `GET /auth/:provider` (issue state, redirect a authorization URL) + callbacks `/auth/google/callback` y `/auth/github/callback` (consume state, refresh cookie HttpOnly)
- `[x]` Wiring: `AuthModule` agrega `HandleOAuthCallbackUseCase`, `OAuthController`, strategies, RedisOAuthStateStore + `OAUTH_STATE_STORE` + `ACCOUNT_PROVIDER_REPOSITORY` bindings
- `[x]` Unit tests: **6 tests** del use case (first-login crea user con passwordHash null + emailVerified, login con link existente, conflict cuando email existe sin auth, link OK cuando authed user matches email, conflict cuando authed user mismatches email, rechazo si email no verificado por provider)
- `[ ]` E2E con `nock` mockeando providers

---

## M6 — Hardening prod `[~]` (~70%)

| Feature                    | Scenarios | Estado                                                                                        | Spec                                                                                                           |
| -------------------------- | --------: | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Liveness / readiness       |         4 | `[~]` `/api/health/live` + `/api/health/ready` con DB + Redis + metadata; falta E2E           | [`features/health/liveness-readiness.feature`](./features/health/liveness-readiness.feature)                   |
| Expand-contract migrations |         6 | `[~]` squawk en CI rechaza patterns peligrosos en migrations modificadas                      | [`database/features/expand-contract.feature`](./database/features/expand-contract.feature)                     |
| Rollback failed migration  |         3 | `[~]` runbook documentado (`AGENTS/database/03-rollback-runbook.md`); falta ensayo en staging | [`database/features/rollback-failed-migration.feature`](./database/features/rollback-failed-migration.feature) |

**Sub-tasks:**

- `[x]` `src/otel.ts` con NodeSDK + auto-instrumentations + OTLP HTTP exporters (traces + metrics). Activación condicional vía `OTEL_EXPORTER_OTLP_ENDPOINT`. Importado primero en `main.ts` para que las auto-instrumentations enganchen
- `[x]` `ThrottlerModule.forRootAsync` con `@nest-lab/throttler-storage-redis` cuando `REDIS_URL` está seteado (multi-pod) + fallback in-memory si no
- `[x]` `squawk` lint en CI sobre migrations modificadas (job `migration-lint` que detecta cambios vía git diff y descarga binario de squawk)
- `[x]` Trivy fs scan en CI (`severity: CRITICAL,HIGH`, `exit-code: 1`, ignore-unfixed)
- `[x]` Dependency audit: `pnpm audit --prod --audit-level high` en CI
- `[x]` `scripts/deploy.sh` (env-agnostic skeleton para k8s/ECS) con migrations → rollout → smoke → auto-rollback en falla
- `[x]` `scripts/smoke.sh` (curl) ejercita health/live, health/ready, /api/docs, login con body inválido (400), refresh sin cookie (401)
- `[x]` `scripts/smoke.k6.js` — 100 RPS sostenidos 1min con thresholds p95<500ms, p99<1.5s, errors<1%
- `[ ]` Cache abilities en Redis con pub/sub invalidation (M4 deferred)
- `[ ]` Aprobación manual GitHub Environments para prod (config-only, fuera de repo)
- `[ ]` Migration runbook ensayado en staging (operativo, no código)

---

## M7 — Templating `[~]` (~85%)

- `[ ]` Marcar repo como GitHub template (config en Settings de GitHub, fuera de repo)
- `[x]` `scripts/init-project.mjs` — rename `package.json`, generar `COOKIE_SECRET` (48B base64url) + RSA 2048 keypair RS256 escritos en `.env`, imprime checklist post-init
- `[x]` `README.md` final con quickstart < 5min, stack table, comandos, endpoints overview, security summary, links a AGENTS
- `[x]` `CONTRIBUTING.md` con Conventional Commits + reglas de capas + checklist PR + reglas de migrations + secrets policy
- `[x]` `LICENSE` MIT
- `[x]` `CLAUDE.md` reescrito reflejando NestJS 11 + Prisma 7 + Postgres 17 + hexagonal/DDD (reemplaza la versión legacy MySQL)

---

## Features index (todos los Gherkin)

### Auth (9 features · 39 scenarios)

- [`features/auth/registration.feature`](./features/auth/registration.feature) — 6
- [`features/auth/login.feature`](./features/auth/login.feature) — 6
- [`features/auth/refresh-token.feature`](./features/auth/refresh-token.feature) — 5
- [`features/auth/logout.feature`](./features/auth/logout.feature) — 3
- [`features/auth/password-reset.feature`](./features/auth/password-reset.feature) — 4
- [`features/auth/email-verification.feature`](./features/auth/email-verification.feature) — 3
- [`features/auth/account-lockout.feature`](./features/auth/account-lockout.feature) — 3
- [`features/auth/oauth-google.feature`](./features/auth/oauth-google.feature) — 5
- [`features/auth/oauth-github.feature`](./features/auth/oauth-github.feature) — 4

### RBAC (3 features · 13 scenarios)

- [`features/rbac/roles-management.feature`](./features/rbac/roles-management.feature) — 4
- [`features/rbac/permissions-management.feature`](./features/rbac/permissions-management.feature) — 3
- [`features/rbac/authorization-checks.feature`](./features/rbac/authorization-checks.feature) — 6

### Users (4 features · 15 scenarios)

- [`features/users/create-user.feature`](./features/users/create-user.feature) — 3
- [`features/users/update-user-profile.feature`](./features/users/update-user-profile.feature) — 4
- [`features/users/list-users-paginated.feature`](./features/users/list-users-paginated.feature) — 4
- [`features/users/soft-delete-user.feature`](./features/users/soft-delete-user.feature) — 4

### Health (1 feature · 4 scenarios)

- [`features/health/liveness-readiness.feature`](./features/health/liveness-readiness.feature) — 4

### Database (2 features · 9 scenarios)

- [`database/features/expand-contract.feature`](./database/features/expand-contract.feature) — 6
- [`database/features/rollback-failed-migration.feature`](./database/features/rollback-failed-migration.feature) — 3

**Total: 19 features · 80 scenarios.**

---

## Decisions log (índice rápido)

| ADR                                                               | Tema                                                                         | Estado   |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------- |
| [001](./planning/decisions/ADR-001-prisma-vs-typeorm.md)          | Prisma 7 sobre TypeORM                                                       | Accepted |
| [002](./planning/decisions/ADR-002-hexagonal-with-ddd.md)         | Hexagonal + DDD building blocks                                              | Accepted |
| [003](./planning/decisions/ADR-003-argon2id-password-hashing.md)  | argon2id (m=64MB, t=3, p=1)                                                  | Accepted |
| [004](./planning/decisions/ADR-004-jwt-cookie-delivery.md)        | Access body + Refresh cookie HttpOnly                                        | Accepted |
| [005](./planning/decisions/ADR-005-casl-rbac-abac.md)             | CASL para RBAC + ABAC                                                        | Accepted |
| [006](./planning/decisions/ADR-006-pino-otel-observability.md)    | pino + OpenTelemetry                                                         | Accepted |
| [007](./planning/decisions/ADR-007-expand-contract-migrations.md) | Expand-Contract migrations                                                   | Accepted |
| [008](./planning/decisions/ADR-008-di-with-nestjs-container.md)   | DI con contenedor NestJS también en `application/` (acoplamiento consciente) | Accepted |

## Bloqueos / decisiones abiertas

_(actualmente ninguno)_

## Changelog del progreso

- **2026-05-02** — M0 cerrado (docs + Gherkin completos). M1 iniciado.
- **2026-05-02** — M1 al ~85%: stack pinneado (NestJS 11.1, Prisma 7.8, Pino, Helmet, Throttler), tsconfig strict, ESLint flat con boundaries, Docker multi-stage Node 24, schema Prisma + seed, src/ skeleton (main + app + health + shared/{prisma,redis} + correlation interceptor), legacy MySQL/TypeORM removido. `pnpm install`, `prisma generate`, `typecheck`, `build`, `lint:check` verdes.
- **2026-05-03** — M1 cerrado (salvo otel + docker smoke). Husky + lint-staged + commitlint con Conventional Commits validados. CI workflow (`.github/workflows/ci.yml`) con jobs lint+typecheck, unit, integration (services postgres+redis), build, audit, Trivy scan.
- **2026-05-03** — M2 cerrado: domain kernel completo (Result, Entity, AggregateRoot, ValueObject, DomainEvent/BaseDomainEvent, Specification con and/or/not, jerarquía DomainError) + application layer (UseCase base, ports IClock/IEventBus/IUnitOfWork, GlobalExceptionFilter mapeando Domain/Http/Prisma→HTTP) + adapters (SystemClock, InMemoryEventBus) + SharedModule global. **24 unit tests verdes**, kernel domain con coverage 100% en Result/Specification/EventBus, 84% en ValueObject. PrismaUnitOfWork deferred a M3.
- **2026-05-03** — M5 al ~85%: OAuth2 social (Google + GitHub) cableado end-to-end. `OAuthProfile` VO + `AccountProvider` entity + `User.registerViaOAuth` factory (passwordHash null, emailVerifiedAt=now). `RedisOAuthStateStore` para state CSRF (TTL 10min, fallback in-memory). `HandleOAuthCallbackUseCase` con 4 ramas (existing link → login / linker match → link / linker mismatch → conflict / new user). Strategies Passport para ambos providers; `OAuthController` con `GET /auth/:provider` (issue state) + 2 callbacks. **98 unit tests verdes (17 suites)** con 6 escenarios del use case OAuth. Pendiente: E2E con `nock`.
- **2026-05-03** — M6 al ~70%: hardening prod. `src/otel.ts` con NodeSDK + auto-instrumentations Node (HTTP/Prisma/Redis) + OTLP HTTP exporters para traces y metrics, activación condicional por `OTEL_EXPORTER_OTLP_ENDPOINT`, importado primero en `main.ts`. `ThrottlerModule.forRootAsync` ahora usa `ThrottlerStorageRedisService` cuando `REDIS_URL` está seteado (multi-pod safe) con fallback in-memory single-pod. CI workflow extendido con job `migration-lint` (detecta migrations modificadas vía git diff, descarga squawk, falla si encuentra patterns peligrosos). `scripts/deploy.sh` env-agnostic con migrations → rollout → smoke → auto-rollback. `scripts/smoke.sh` (curl) cubre 5 endpoints. `scripts/smoke.k6.js` con 100 RPS / 1min / thresholds p95<500ms p99<1.5s errors<1%. `.gitignore` reforzado con tsbuildinfo / husky cache / prisma db artifacts. **typecheck + lint + build verdes; 98/98 tests**.
- **2026-05-03** — M3 al ~95%: bounded context `auth/` con migración inicial (185 líneas SQL + down.sql), 7 VOs, 4 entities/aggregates (User con lockout policy, Session, RefreshToken con flagReuse, OneTimeToken con TTL por purpose), 7 events, 11 errors tipados, 9 ports, **8 use cases** (Register con auto-emit verify, Login constant-time, Refresh con rotation + theft detection, Logout idempotente, VerifyEmail, ResendVerification anti-enumeration, RequestPasswordReset anti-enumeration, ResetPassword que revoca todas las sesiones), Argon2id + RS256 JWT con dev fallback + sha256 token generators + 4 Prisma repos + ConsoleMailer, AuthController con **9 endpoints** + throttler granular (register 5/h, login 5/10min, refresh 30/min, resend 1/min, pwd-reset 5/10min) + cookie HttpOnly Secure SameSite=Strict signed Path=/api/auth, JwtStrategy + Guard + @CurrentUser. **79 unit tests verdes (13 suites)**. Pendiente: admin unlock (post-RBAC) + E2E con Postgres real.
- **2026-05-03** — M3 cerrado funcionalmente + M4 al ~70%: bounded context `rbac/` con `Role` aggregate (replacePermissions emit event, system role inmutable), `Permission` entity, 3 VOs, 3 events, 6 errors tipados; 4 ports + 4 adapters Prisma; `CaslAbilityFactory` resuelve placeholders `$user.id` en CASL conditions; `PoliciesGuard` + `@CheckPolicies(...)` decorator funcionando; 4 use cases (Assign/Remove/ListRoles/ListPermissions) + `AdminUnlockUserUseCase` cierra M3 lockout; `RolesController` (4 endpoints protegidos) + `AdminController` (unlock guard `unlock:User OR manage:User OR manage:all`); `RbacModule` cableado e importado por `AuthModule`. **92 unit tests verdes (16 suites)** incluyendo `buildAbility` con manage:all wildcard / ABAC conditions / unlock-no-implies-manage. Pendiente M4: cache abilities Redis con pub/sub, CRUD completo de roles, accessibleBy(ability) en otros bounded contexts, E2E.
