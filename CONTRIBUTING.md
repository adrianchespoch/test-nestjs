# Contributing

## Pre-requisitos

- Node 24 LTS (`.nvmrc`)
- pnpm 9 (Corepack: `corepack enable`)
- Docker (para tests integration / e2e con Testcontainers)

## Workflow

```sh
git checkout -b feat/<short-description>
# … cambios …
pnpm typecheck
pnpm lint
pnpm test:unit
git add -A
git commit -m "feat: short description"   # commitlint valida
git push -u origin feat/<short-description>
gh pr create --fill
```

## Reglas

### 1. Conventional Commits

`commit-msg` hook valida el formato. Tipos permitidos: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`, `revert`.

```
feat(auth): add admin unlock endpoint with RBAC guard

Body opcional explicando el porqué del cambio (no el qué).

BREAKING CHANGE: opcional para semver mayor.
```

### 2. Reglas de capas (hexagonal)

`eslint-plugin-boundaries` rechaza imports cruzados ilegales:

- `domain/` puede importar solo de `domain/` y `shared/domain/`. **Cero NestJS, cero Prisma**.
- `application/` puede importar de `domain/` + `application/` + shared.
- `infrastructure/` y `presentation/` pueden importar de cualquier capa interna.
- Cross-bounded-context: prohibido importar entre módulos directamente. Solo via ports publicados o el `RbacModule.exports` style.

### 3. Migrations

Cada migration **DEBE** tener su `down.sql`. CI corre `squawk` sobre migrations modificadas.

Si tu migration toca una tabla con > 100K rows o cambia constraints, sigue **Expand-Migrate-Contract** (ver `AGENTS/database/02-migration-strategy.md`).

Patterns rechazados por squawk:

- `ALTER COLUMN ... NOT NULL DEFAULT '...'` sobre tabla poblada (lock)
- `CREATE INDEX` sin `CONCURRENTLY`
- `ALTER TABLE ... RENAME COLUMN`
- `DROP COLUMN` sin proceso documentado

### 4. Tests

- **Domain layer**: 90%+ coverage, sin DB, sin Nest, sin Redis. Mocks manuales.
- **Use cases**: cubrir happy path + cada `Result.Err` posible.
- **Adapters Prisma/Redis**: integration tests con Testcontainers.
- **E2E por feature Gherkin**: al menos un escenario representativo via supertest.

Ver `AGENTS/testing/`.

### 5. PRs

- 1 commit lógico = 1 PR (no mezcles refactor + feature en el mismo PR).
- Descripción del PR responde: ¿por qué? ¿cómo se prueba?
- Reviewer obligatorio si tocás `prisma/migrations/`, `src/modules/auth/`, o `.github/workflows/`.
- CI verde antes de squash-merge.

### 6. Decisiones arquitecturales

Si tu cambio afecta una decisión documentada en `AGENTS/planning/decisions/ADR-*.md`, agrega un ADR nuevo que **supersede** al anterior. No edites ADRs aceptados.

### 7. Secrets

- Nunca commits con secrets reales.
- Si agregas envvar nueva: actualiza `.env.example` **y** `src/config/env.schema.ts` (Joi).
- Logs no deben incluir tokens, passwords ni PII (ver paths redacted en `app.module.ts`).

## Code review checklist

- [ ] Tests pasan (incluye E2E si tocás flows críticos)
- [ ] Coverage no baja >1%
- [ ] Lint + typecheck verdes
- [ ] Conventional Commit
- [ ] `down.sql` si hay migration
- [ ] `.env.example` actualizado si hay envvar nueva
- [ ] ADR si la decisión cambia
- [ ] Swagger docs actualizados si endpoints cambian
- [ ] Sin secrets en repo

## Reportar bugs

Issues con template: pasos para reproducir + comportamiento esperado vs. actual + versión del skeleton (`git rev-parse --short HEAD`).

Si el bug es de seguridad, **no abras issue público** — ver `SECURITY.md` (TBD por el equipo del proyecto).
