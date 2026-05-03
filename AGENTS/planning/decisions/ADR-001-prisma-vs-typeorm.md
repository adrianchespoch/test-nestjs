# ADR-001 — Prisma sobre TypeORM como ORM principal

**Status**: Accepted (Mayo 2026)

## Context

El repo inicial usa TypeORM 0.3 + MySQL. Para el skeleton necesitamos un ORM con:

- Tipos seguros end-to-end (request → DB → response).
- Migraciones declarativas con plan de aplicación claro.
- Soporte nativo Postgres (gaps de TypeORM en JSON, arrays, full-text).
- Workflow de rollback ensayable.
- Integración natural con tests (Testcontainers).
- Comunidad y mantenimiento activos.

Candidatos evaluados: TypeORM, Prisma, MikroORM, Drizzle.

## Decision

Adoptamos **Prisma 7.x** como ORM exclusivo. Motivos:

1. **DX y type-safety**: el cliente generado refleja el schema, no hay drift entre runtime y types.
2. **Migrate**: `prisma migrate` produce SQL inspeccionable y aplicable manualmente. Soporta down migrations vía `migrate diff` + `db execute`.
3. **NestJS integration estándar**: patrón `PrismaService` documentado oficialmente por NestJS y por Prisma.
4. **Postgres-first**: introspección y soporte de tipos nativos (json, jsonb, arrays, enums) sin workarounds.
5. **Savepoints (v7.5+)**: rollback de transacciones anidadas.

Rechazamos:

- **TypeORM**: API histórica inconsistente, decoradores con magia implícita, migraciones generadas frágiles.
- **MikroORM**: bueno técnicamente pero comunidad menor, menos integraciones third-party.
- **Drizzle**: muy ligero pero todavía joven para prod-ready opinionado; sin migraciones de primera clase comparables.

## Consequences

**Positivas**:

- `pnpm prisma generate` da tipos exactos sin escribir DTOs duplicados.
- Schema único como fuente de verdad.
- Test factories pueden usar `Prisma.UserCreateInput` directamente.
- Filtrado a nivel query con `@casl/prisma` (ver ADR-005).

**Negativas / mitigaciones**:

- **Prisma 7 ESM-first**: forzar `moduleFormat = "cjs"` en generator hasta NestJS 12.
- **Schema en un solo archivo**: archivos grandes en proyectos maduros — usar `prisma-multifile-schema` cuando aplique.
- **Generación obligatoria post-pull**: agregar `pnpm prisma generate` a postinstall y a hook de Husky `post-merge`.
- **Lock-in al cliente Prisma**: el dominio nunca importa Prisma directamente — solo los adapters de infraestructura. Esto deja la puerta abierta a swap si Prisma deja de mantenerse.

**Riesgos abiertos**:

- Auto-rollback de DDL no es trivial en ningún ORM. Ver ADR-007 (expand-contract).
- Costo del cliente generado en builds grandes — mitigado con Prisma Accelerate o engine binary.
