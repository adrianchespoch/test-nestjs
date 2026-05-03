# AGENTS — Skeleton NestJS prod-ready

> 🚀 **Punto de entrada para sesiones nuevas: [`GLOBAL.md`](./GLOBAL.md)** — resumen ejecutivo autocontenido. Léelo primero; el resto de archivos solo cuando necesites detalle de un tema concreto.

Documentación de diseño + reglas de negocio en Gherkin para un skeleton NestJS reutilizable. Esta carpeta es el **source of truth** del diseño + estado del proyecto.

> **Estado actual** (ver [`PROGRESS.md`](./PROGRESS.md)): NestJS 11 + Prisma 7 + Postgres 17, hexagonal + DDD, auth completa, RBAC con cache, observabilidad OTel. M0–M4 cerrados; M5–M7 al ~85%.

## Cómo navegar

| Carpeta                            | Para qué                                                           |
| ---------------------------------- | ------------------------------------------------------------------ |
| [`planning/`](./planning/)         | Contexto, stack, roadmap y ADRs (decisiones arquitecturales)       |
| [`architecture/`](./architecture/) | Hexagonal + DDD + SOLID + design patterns + cross-cutting concerns |
| [`features/`](./features/)         | Reglas de negocio en Gherkin (BDD ejecutable)                      |
| [`database/`](./database/)         | Prisma setup, estrategia de migraciones, runbook de rollback       |
| [`testing/`](./testing/)           | Pirámide de tests, Testcontainers, fixtures, coverage policy       |
| [`prod/`](./prod/)                 | Config/secrets, Docker, CI/CD, runbook de incidente, readiness     |

## Por dónde empezar

1. [`planning/00-context.md`](./planning/00-context.md) — qué problema resuelve este skeleton
2. [`planning/01-stack-versions.md`](./planning/01-stack-versions.md) — matriz de versiones LTS
3. [`architecture/01-hexagonal-overview.md`](./architecture/01-hexagonal-overview.md) — el modelo
4. [`features/auth/registration.feature`](./features/auth/registration.feature) — primer caso de uso

## Convenciones

- **Gherkin**: en inglés (estándar Cucumber). `Feature` + `Background` + `Scenario` o `Scenario Outline`.
- **ADRs**: numerados, formato `Status / Context / Decision / Consequences`. Una decisión = un ADR.
- **Markdown**: títulos H1 una vez por archivo. Code blocks con language hint.
- **Versionado**: cuando cambie una decisión, no edites el ADR existente — crea uno nuevo que la **supersede** y marca el anterior como `Superseded by ADR-NNN`.

## Decisiones lock-in (Mayo 2026)

- Single-tenant (no multi-tenancy en v1).
- JWT: access en body + refresh en cookie `HttpOnly; Secure; SameSite=Strict`.
- Auth providers: email/password local (argon2id) + OAuth2 social (Google, GitHub).
- ORM: Prisma 7.x con Postgres 17.
- Observabilidad: pino + OpenTelemetry desde día 1.
