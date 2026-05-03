# 02 — Roadmap de implementación

Fases secuenciales para construir el skeleton. Cada milestone es independientemente desplegable y testeable.

## M0 — Documentación (esta carpeta)

**Outcome**: ADRs, arquitectura y Gherkin features escritos. Sin código de la app aún.
**Estado**: en curso.

## M1 — Bootstrap & infra base

**Outcome**: `pnpm install && pnpm dev` levanta Nest 11 con OTel + pino + helmet + Swagger contra Postgres+Redis vía docker-compose. Sin auth todavía.

Tareas:

- Limpiar repo legacy (preservar `CLAUDE.md` original como `CLAUDE.legacy.md`).
- `package.json` con stack pinneado de [`01-stack-versions.md`](./01-stack-versions.md).
- `tsconfig.json` strict.
- ESLint + Prettier + Husky.
- `docker-compose.yml` con `postgres:17` + `redis:7-alpine`.
- `Dockerfile` multi-stage Node 24.
- `src/main.ts` con OTel SDK init **antes** de `NestFactory`, helmet, validation pipe global, Swagger.
- `src/shared/infrastructure/prisma/PrismaService.ts`.
- `src/shared/infrastructure/redis/RedisService.ts`.
- Health module con `@nestjs/terminus` (live + ready).
- CI: GitHub Actions con lint + test + build.

**Verificación**: `curl /health/ready` → 200, `/api/docs` carga, logs JSON con traceId.

## M2 — Domain bootstrap & shared kernel

**Outcome**: Building blocks DDD listos: `Result`, `BaseEntity`, `ValueObject`, `DomainEvent`, `EventBus` in-memory.

Tareas:

- `src/shared/domain/Result.ts` (Ok/Err, sin throw).
- `src/shared/domain/Entity.ts`, `AggregateRoot.ts`, `ValueObject.ts`.
- `src/shared/domain/DomainEvent.ts` + `IEventBus`.
- `src/shared/application/UseCase.ts` base.
- Filter global que mapea `Result.Err` y `DomainException` a HTTP.
- Tests unitarios de los building blocks.

## M3 — Auth: email/password local

**Outcome**: Registro, login, refresh, logout, password reset, email verification, lockout. Argon2id. Refresh con rotación + theft detection.

Tareas:

- Bounded context `auth/` con domain pure (Session, RefreshToken, Email VO, Password VO).
- Use cases: Register, Login, Refresh, Logout, RequestPasswordReset, ResetPassword, VerifyEmail.
- Adapters: `PrismaSessionRepository`, `ArgonHasher`, `JwtSigner`, `MailerAdapter`.
- Controllers con DTOs validados.
- Throttler aplicado a endpoints sensibles.
- Cumplir todos los escenarios de [`features/auth/`](../features/auth/).

**Verificación**: features Gherkin verdes (E2E con supertest + Testcontainers).

## M4 — RBAC: roles y permisos con CASL

**Outcome**: Roles, permisos, abilities cacheadas en Redis, guards CASL, filtrado de queries con `@casl/prisma`.

Tareas:

- Bounded context `rbac/` (Role, Permission, Ability).
- `AbilityFactory` que construye `Ability` desde rol del user.
- `PoliciesGuard` (decorator `@CheckPolicies`).
- Cache en Redis con invalidate-on-role-change.
- Endpoints CRUD de roles/permisos protegidos por sí mismos.
- Cumplir features de [`features/rbac/`](../features/rbac/).

## M5 — OAuth2 social (Google + GitHub)

**Outcome**: Login con Google/GitHub. Account linking. State CSRF.

Tareas:

- Strategies de Passport.
- Tabla `account_provider` (userId, provider, providerAccountId, accessToken cifrado).
- Endpoints `/auth/google` y `/auth/github` + callbacks.
- Cumplir features OAuth.

## M6 — Hardening prod

**Outcome**: Skeleton listo para deploy. CI/CD completo, runbooks, smoke tests post-deploy.

Tareas:

- GitHub Actions: matrix de tests (unit + int + e2e) + Snyk/Trivy scan + build container + push registry.
- Helm chart o `docker-compose.prod.yml`.
- Migration runbook ensayado.
- Smoke test post-deploy.
- Performance budget (k6 script básico).
- Feature flags scaffold (LaunchDarkly/Unleash optional).

## M7 — Templating

**Outcome**: Convertir el repo en template GitHub. Docs de "cómo arrancar un nuevo proyecto desde cero".

Tareas:

- Marcar el repo como `template`.
- Variables a renombrar (project name, package name).
- Script de bootstrap (`scripts/init-project.ts`).
- README final con quickstart.

## Tracking

Cada milestone tiene:

- Issue/PR principal
- Sub-issues por bounded context o feature
- Done = features Gherkin verdes + coverage ≥ umbral + smoke OK
