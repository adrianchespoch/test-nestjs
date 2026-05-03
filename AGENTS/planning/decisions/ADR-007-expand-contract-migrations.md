# ADR-007 — Migraciones zero-downtime con expand-contract

**Status**: Accepted (Mayo 2026)

## Context

Aplicar migraciones DDL en producción mientras hay tráfico es la causa #1 de incidentes en apps con DB relacional. Los riesgos:

- `ALTER TABLE` toma write lock prolongado en tablas grandes.
- `DROP COLUMN` rompe versiones viejas de la app que aún están en flight.
- Renames son catastróficos (rompe queries que esperan el nombre viejo).
- Foreign keys nuevas pueden ser inconsistentes con datos existentes.
- Auto-rollback de DDL no es trivial — Postgres lo permite en transacción, pero no todas las DDL son seguras a abortar.

Prisma Migrate por sí solo no protege de esto: aplica el SQL tal cual.

## Decision

**Pattern obligatorio para cambios de schema en prod: expand-contract en 3 deploys.**

### Fases

**1. Expand** (deploy A): agrega lo nuevo sin tocar lo viejo.

- Nueva columna nullable.
- Nuevo índice (CREATE INDEX CONCURRENTLY si Postgres).
- Nueva tabla.
- Nueva FK con `NOT VALID` + `VALIDATE CONSTRAINT` posterior.
- App nueva escribe en ambos sitios (old + new) si aplica.

**2. Migrate** (deploy B o job): backfill datos.

- Script idempotente, en lotes con `LIMIT N`.
- Sin lock global; usa `WHERE ... AND new_col IS NULL`.
- Monitoreado: progreso loggeado, kill switch.

**3. Contract** (deploy C): elimina lo viejo, sólo después de que el app del deploy A sea retirado.

- App nueva ya no escribe en columna vieja.
- `DROP COLUMN`, `DROP TABLE`, `DROP INDEX`.

### Reglas

- **Renombres**: prohibidos en una migration. Usar expand (add new) → migrate (backfill) → switch app → contract (drop old).
- **NOT NULL nuevo**: agregar columna nullable + backfill + `SET NOT NULL` separados.
- **FK nuevas**: `ADD CONSTRAINT ... NOT VALID` luego `VALIDATE CONSTRAINT` en otra migration.
- **Índices**: siempre `CREATE INDEX CONCURRENTLY` en Postgres.

### Rollback

- **En Expand**: la migration es backward-compatible — rollback = no aplicar / revertir es seguro.
- **En Migrate**: el script es idempotente — re-running no daña; abort es seguro.
- **En Contract**: irreversible salvo restore de backup. Solo después de que dataApp viejo está retirado y haya pasado N horas (>= TTL de cache, eventualmente consistente).

### Tooling

- `prisma migrate dev` solo en desarrollo.
- En prod: `prisma migrate deploy` aplica migrations marcadas como deployable.
- Migrations editadas a mano cuando Prisma genera SQL no seguro (ej. cambiar `CREATE INDEX` por `CONCURRENTLY`).
- Down migrations en `migrations/<timestamp>/down.sql` (manual; Prisma no las genera).
- Failed migration: `prisma migrate resolve --rolled-back <name>` y aplicar el `down.sql` con `prisma db execute`.

## Consequences

**Positivas**:

- Cero downtime para schema changes.
- Rollback ensayado (en staging) antes de prod.
- Forzados a pensar en dos versiones de la app coexistiendo.

**Negativas / mitigaciones**:

- **Velocity baja**: un cambio de schema puede tomar 3 deploys → 3 días. Mitigación: aceptar el costo. La alternativa son 3 horas de incidente.
- **Más SQL manual**: Prisma no genera índices CONCURRENTLY ni constraints NOT VALID. Mitigación: checklist en PR template + linter de SQL custom (`squawk`).
- **Disciplina de equipo**: si alguien hace `prisma migrate dev --name rename_x_to_y` y mergea, rompe. Mitigación: hook pre-commit que rechaza migrations con `ALTER COLUMN ... RENAME` o `DROP COLUMN`.

## Referencias

- Prisma Data Guide — Expand and Contract pattern.
- `whoffagents/prisma-migrations-zero-downtime` (DEV, 2026).
- Strong Migrations (Rails) — heurísticas similares aplicables.
- Skill `database-migration` instalada en `.agents/skills/`.
