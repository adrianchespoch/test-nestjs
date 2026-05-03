# ADR-005 — CASL para RBAC + ABAC con filtrado a nivel de query

**Status**: Accepted (Mayo 2026)

## Context

Necesitamos autorización con tres requisitos:

1. **RBAC** (Role-Based): users tienen roles, roles tienen permisos.
2. **ABAC** (Attribute-Based): permisos condicionales sobre atributos del recurso (ej. "puede editar solo si `ownerId === user.id`").
3. **Filtrado en queries**: `findAll` debe devolver solo lo que el caller puede ver — sin filtrado post-fetch.

Opciones evaluadas:

| Opción                                             | RBAC | ABAC   | Query filter                   |
| -------------------------------------------------- | ---- | ------ | ------------------------------ | -------------------- |
| Guards manuales con if/else                        | ✅   | manual | manual                         |
| `@nestjs/casl` (no oficial)                        | —    | —      | —                              |
| **`@casl/ability` + `@casl/prisma`**               | ✅   | ✅     | ✅ vía `accessibleBy(ability)` |
| Cerbos / OpenFGA / SpiceDB (policy engine externo) | ✅   | ✅     | parcial                        | overhead operacional |

## Decision

**`@casl/ability` para definir abilities + `@casl/prisma` para traducir a `where` clauses.**

Modelo:

```ts
// Permiso = (action, subject, conditions?)
permission = { action: 'update', subject: 'Post', conditions: { ownerId: '$user.id' } }

// Role agrupa permisos
role = { name: 'editor', permissions: [...] }

// User tiene roles → AbilityFactory construye Ability runtime
ability.can('update', post)                    // boolean
accessibleBy(ability).Post                     // Prisma where clause
```

**Flow runtime**:

1. `JwtAuthGuard` verifica access token y popula `request.user` con `userId, roleIds`.
2. `AbilityFactory.createForUser(user)` lee roles desde DB (con cache Redis) y compone `Ability`.
3. Cache key: `ability:user:${userId}` con TTL 10 min, invalidado por eventos de cambio de rol.
4. `PoliciesGuard` con decorator `@CheckPolicies((ab) => ab.can('update', 'Post'))`.
5. En queries: `prisma.post.findMany({ where: accessibleBy(ability).Post })`.

**Definición de permisos**: se almacenan en DB (tabla `permissions`) — no en código — para que admins puedan ajustar sin redeploy.

## Consequences

**Positivas**:

- Una sola fuente de verdad de permisos (DB), una sola lib que evalúa.
- Filtrado a nivel SQL (no leak ni overhead de fetch+filter).
- ABAC condicional con sintaxis declarativa.
- Type-safe con `@casl/prisma` generando types desde el schema Prisma.

**Negativas / mitigaciones**:

- **Cache invalidation**: cambiar permisos de un rol debe invalidar todas las abilities de users con ese rol. Mitigación: pub/sub Redis con canal `rbac:role-changed:${roleId}`, los pods invalidan su LRU local.
- **Conditions con datos del request**: `{ ownerId: '$user.id' }` se resuelve en el momento de `createForUser`. Si la condición depende del recurso a chequear, se pasa el recurso a `ability.can(action, instance)`.
- **Performance al construir Ability**: 50–200 permisos × N roles. Mitigación: el hot path es el cache; cache miss <5ms con queries indexadas.
- **Vendor lock CASL**: si CASL deja de mantenerse, migrar a Cerbos requiere reescribir la `AbilityFactory`. Mitigación: domain layer expone interfaz `IPermissionChecker`, CASL es solo el adapter.

**Reglas explícitas**:

- Nunca evaluar permisos en el dominio. El dominio asume que el caller ya está autorizado. Auth se aplica en presentation/application via guards.
- 403 nunca debe revelar la existencia del recurso. Si no se puede leer, responder 404 (excepto cuando el listing ya devolvió el ID).

## Referencias

- CASL docs (`https://casl.js.org`).
- `@casl/prisma` — query-level filtering.
- NIST SP 800-162 — ABAC.
