# 05 — Design patterns catalog

Patrones que aparecen en este skeleton, dónde y por qué. No hay obligación de usarlos todos — solo si el problema los justifica.

## Repository

Encapsula acceso a persistence detrás de una interface dominio-céntrica. Ya cubierto en [02-ddd-building-blocks.md](./02-ddd-building-blocks.md).

**Cuándo**: siempre que un aggregate necesite persistir.
**Anti-uso**: no convertir el repo en un ORM rebrand. Métodos verbales (`findActiveByEmail`), no `find(criteria)`.

## Unit of Work

Agrupa varias operaciones de repositorios en una sola transacción atómica.

```ts
interface IUnitOfWork {
  execute<T>(work: (ctx: UoWContext) => Promise<T>): Promise<T>;
}
```

**Implementación Prisma**: `PrismaUnitOfWork` envuelve `prisma.$transaction(async (tx) => ...)`. Repos reciben `tx` por DI scoped, no `prisma` global.

**Cuándo**: use case que muta dos aggregates o aggregate + side effect transaccional (outbox).

## Result type (Either)

Errores como valores, no excepciones, en el dominio.

```ts
type Result<T, E> = Ok<T> | Err<E>;
```

**Cuándo**: cualquier operación de dominio o use case que pueda fallar por reglas de negocio. Excepciones se reservan para fallas de infra (DB caída, timeout).

**Beneficios**: el caller tiene que manejar el error explícitamente. Tipos lo fuerzan.

## Specification

Encapsula reglas de filtrado o validación.

```ts
class CanReceiveMarketingEmail implements Specification<User> {
  isSatisfiedBy(u: User): boolean {
    return u.emailVerified && u.preferences.marketing && !u.suspended;
  }
}
```

**Cuándo**: la regla se reusa en varias queries o validations. Para filtrar en DB, combinar con `accessibleBy(ability)` de CASL o convertir a `where` Prisma.

## Strategy

Múltiples implementaciones intercambiables de un comportamiento.

**Aplicado en**: `IOAuthProvider` (Google, GitHub, Microsoft). El use case `OAuthCallback` recibe la strategy correcta vía un factory por slug.

```ts
class OAuthProviderRegistry {
  resolve(provider: 'google' | 'github'): IOAuthProvider {
    /* ... */
  }
}
```

## Factory

Cuando construir un objeto requiere lógica compleja o decidir tipo concreto.

**Aplicado en**:

- `AbilityFactory.createForUser(user)` — construye `Ability` desde roles.
- `OAuthProviderRegistry` arriba.
- `User.register(email, password)` (factory method estático en aggregate).

## Mapper

Conversión entre representaciones. Ya cubierto en building blocks.

**Regla**: tres mappers por aggregate (`toDomain`, `toPersistence`, `toDTO`). No automapper mágico — explícito siempre.

## Domain Event + Event Bus + Outbox

Para side effects desacoplados y entregables tras commit.

```ts
class UserRegistered implements DomainEvent {
  /* ... */
}

// En use case:
await uow.execute(async (tx) => {
  await users.save(user, tx);
  await outbox.append(user.pullEvents(), tx); // mismo tx que save
});
// Background worker lee outbox y publica al bus real (in-memory, BullMQ, Kafka).
```

**Cuándo**: side effects que deben ocurrir post-commit con guarantees at-least-once (enviar email de verificación, sincronizar con CRM).

**Anti-pattern**: emitir eventos antes del commit. Si la transacción falla, el efecto ocurrió igual.

## Decorator (Nest interceptor)

Cross-cutting transversal: logging, transform de respuesta, métricas.

**Aplicado**:

- `CorrelationIdInterceptor` — inyecta requestId al logger.
- `TransformResultInterceptor` — convierte `Result.Err` en `HttpException` apropiada.
- `@Span()` de `nestjs-otel` para tracing.

## Observer (vía DomainEvents)

Use case publica evento, varios subscribers reaccionan sin acoplamiento.

```ts
@OnEvent('user.registered')
class SendVerificationEmailHandler {
  handle(e: UserRegistered) {
    /* ... */
  }
}
```

## Chain of Responsibility (guards)

`JwtAuthGuard` → `RolesGuard` → `PoliciesGuard`. Cada uno decide o pasa al siguiente. NestJS los compone vía `@UseGuards()`.

## Saga / Process Manager

**No incluido en v1**. Si surge un workflow multi-paso con compensaciones (ej. checkout con pago + reservar inventario + emitir factura), modelarlo como Process Manager con eventos. Hasta entonces, no anticipar.

## CQRS

**No incluido en v1**. NestJS tiene `@nestjs/cqrs` y es tentador, pero introduce overhead conceptual sin beneficio si las queries no son distintas de los commands. Adoptar **solo** cuando aparezcan modelos de lectura denormalizados (caching, search, projections).
