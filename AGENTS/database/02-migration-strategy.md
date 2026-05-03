# 02 — Migration strategy (expand-contract)

> Decisión: ver [`ADR-007`](../planning/decisions/ADR-007-expand-contract-migrations.md).

## TL;DR

**Cualquier cambio destructivo o que requiera backfill se separa en 3 deploys:**

```
deploy A: Expand   → agregar lo nuevo, mantener lo viejo, app escribe en ambos
deploy B: Migrate  → backfill datos en background
deploy C: Contract → eliminar lo viejo
```

## Tabla de decisiones por tipo de cambio

| Cambio                | Pattern                             | Notas                                                |
| --------------------- | ----------------------------------- | ---------------------------------------------------- |
| Add nullable column   | Single migration                    | Backward compatible. Sin rollback necesario.         |
| Add NOT NULL column   | Expand-Migrate-Contract             | Add nullable → backfill → SET NOT NULL               |
| Drop column           | Expand-Contract (sin Migrate)       | Stop writing → wait → DROP COLUMN                    |
| Rename column         | Expand-Migrate-Contract             | Add new → backfill → switch app → drop old           |
| Add index             | Single migration con `CONCURRENTLY` | Editar SQL generado por Prisma                       |
| Drop index            | Single migration                    | Bajo. Sin write lock.                                |
| Add FK                | Expand-Validate                     | `ADD CONSTRAINT ... NOT VALID` → validar después     |
| Add unique constraint | Expand-Validate                     | Crear índice unique CONCURRENTLY → swap a constraint |
| Change column type    | Expand-Migrate-Contract             | Add new → backfill → switch app → drop old           |
| Split table           | Expand-Migrate-Contract complejo    | Caso por caso                                        |

## Workflow paso a paso

### 1. Cambio en schema.prisma + migration generation

```sh
# En dev
pnpm prisma migrate dev --name add_user_phone_column
```

Esto crea `prisma/migrations/<timestamp>_add_user_phone_column/migration.sql`.

### 2. Editar migration SQL si Prisma generó algo inseguro

Ejemplo: Prisma genera `CREATE INDEX ON ...`, pero en Postgres prod queremos `CONCURRENTLY`:

```sql
-- migration.sql (editado a mano)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_phone_idx" ON "User"("phone");
```

> Linter sugerido: [squawk](https://github.com/sbdchd/squawk) — ejecuta en CI sobre el `.sql`, falla si encuentra patrones peligrosos (`ALTER TABLE ... ADD COLUMN NOT NULL`, `RENAME`, `DROP COLUMN`, etc.).

### 3. Crear `down.sql` manualmente (Prisma no lo hace)

```sql
-- prisma/migrations/<timestamp>_add_user_phone_column/down.sql
DROP INDEX IF EXISTS "User_phone_idx";
ALTER TABLE "User" DROP COLUMN IF EXISTS "phone";
```

Convención: cada migration tiene su `down.sql` adyacente. Aunque Prisma no lo ejecute auto, lo necesitamos para incidentes (ver [`03-rollback-runbook.md`](./03-rollback-runbook.md)).

### 4. Ensayar en staging

```sh
DATABASE_URL=postgres://staging... pnpm prisma migrate deploy
# luego ejercitar smoke tests
# luego ensayar el rollback:
psql $DATABASE_URL -f prisma/migrations/<timestamp>_add_user_phone_column/down.sql
```

### 5. Apply en prod

```sh
# CI/CD pipeline (no manual)
pnpm prisma migrate deploy
```

Idealmente ejecutado en un job dedicado **antes** de hacer rollout del deployment.

## Patrón Expand-Migrate-Contract en detalle

Ejemplo: agregar columna `User.fullName` requerida basada en `firstName + lastName`.

### Deploy A — Expand

```sql
ALTER TABLE "User" ADD COLUMN "fullName" VARCHAR(240);
-- nullable, sin default; safe.
```

App nueva (deploy A):

- Sigue leyendo `firstName`, `lastName`.
- Al **escribir** (insert/update), también escribe `fullName = firstName + ' ' + lastName`.

### Backfill (job B)

```sql
-- script idempotente; ejecutar en lotes
UPDATE "User"
SET "fullName" = "firstName" || ' ' || "lastName"
WHERE "fullName" IS NULL
LIMIT 1000;
-- repetir hasta 0 rows updated
```

Loggea progreso. Tiene kill switch (`AND id NOT IN (SELECT id FROM "user_backfill_skip")`).

### Deploy B — switch reads

App actualizada lee `fullName` directamente.

### Deploy C — Contract

```sql
ALTER TABLE "User" ALTER COLUMN "fullName" SET NOT NULL;
ALTER TABLE "User" DROP COLUMN "firstName";
ALTER TABLE "User" DROP COLUMN "lastName";
```

Solo después de que la versión que aún lee/escribe `firstName/lastName` esté retirada **y** el rollback window haya pasado.

## Reglas de migration safe

1. **Nunca renombrar una columna en una migration**. Add new + migrate + drop old.
2. **Nunca agregar NOT NULL a una columna existente sin default**. Add nullable + backfill + SET NOT NULL.
3. **Nunca agregar default value en una columna grande**. Postgres reescribe la tabla entera (lock). Backfill manualmente.
4. **`CREATE INDEX` sin `CONCURRENTLY`** = write lock. En Postgres, siempre concurrently.
5. **`DROP TABLE` solo si nadie escribe**. Ensayar con app de monitoring para detectar últimos accesses.
6. **No mezclar DDL y DML en la misma migration**. Si necesitas backfill, hazlo en script aparte (job).

## Commits

- Cada migration en su propio PR.
- PR description con la decisión expand vs contract y por qué.
- Reviewer obligado a chequear `down.sql`.
- Approval explícito del DBA o del owner del schema en cambios destructivos.

## Lock awareness

Postgres locks por DDL:

| DDL                                         | Lock                         | Impacto           |
| ------------------------------------------- | ---------------------------- | ----------------- |
| ADD COLUMN nullable, no default             | AccessExclusive momentáneo   | OK                |
| ADD COLUMN with default (volatile)          | AccessExclusive **largo**    | Mal               |
| ADD COLUMN with default (constant) en pg11+ | AccessExclusive momentáneo   | OK                |
| ALTER COLUMN TYPE                           | Reescribe tabla              | Mal               |
| ADD CONSTRAINT FK                           | AccessExclusive + scan tabla | Usar NOT VALID    |
| CREATE INDEX                                | ShareLock (bloquea writes)   | Usar CONCURRENTLY |

`pg_locks` es tu amigo durante un incidente.
