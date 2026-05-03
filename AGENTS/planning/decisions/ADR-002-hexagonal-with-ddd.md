# ADR-002 — Arquitectura hexagonal con building blocks DDD

**Status**: Accepted (Mayo 2026)

## Context

El usuario pidió aplicar Clean Architecture, Hexagonal, SOLID, DDD y design patterns. Estas no son decisiones excluyentes — son **superposiciones** del mismo problema (separar dominio de infraestructura, aislar I/O, hacer el código testeable). Necesitamos escoger UNA estructura de carpetas y un vocabulario para no caer en parálisis arquitectural.

Candidatos:

1. **Clean Architecture (Uncle Bob)**: capas concéntricas Entities → Use Cases → Interface Adapters → Frameworks.
2. **Hexagonal (Cockburn)**: domain core con ports (interfaces) y adapters (implementaciones), driving vs driven.
3. **DDD táctico solo**: bounded contexts con aggregates/entities/VOs sin compromiso de capas.
4. **Layered tradicional Nest**: controller → service → repository (lo que hace casi todo el ecosistema Nest).

## Decision

**Hexagonal como skeleton estructural + DDD building blocks dentro del dominio + nomenclatura de Clean para casos de uso.**

```
src/modules/<bounded-context>/
├── domain/                      # capa pura, cero NestJS/Prisma
│   ├── entities/                # AggregateRoot + Entity
│   ├── value-objects/           # Email, Password, Money, etc.
│   ├── events/                  # DomainEvent
│   ├── services/                # DomainService (cuando una operación cruza aggregates)
│   └── repositories/            # interfaces (driven ports)
├── application/                 # use cases / command handlers
│   ├── use-cases/               # uno por archivo: LoginUseCase.ts
│   └── ports/                   # driven ports adicionales (Hasher, EmailSender)
├── infrastructure/              # adapters
│   ├── persistence/             # PrismaXxxRepository
│   ├── auth/                    # JwtSigner, ArgonHasher
│   └── http/                    # external API clients
└── presentation/                # driving adapters
    ├── http/
    │   ├── controllers/
    │   ├── dtos/
    │   └── guards/
    └── (graphql/cli/queue si aplica)
```

**Reglas de dependencia** (forzadas por ESLint con `@nx/enforce-module-boundaries` o `eslint-plugin-boundaries`):

- `domain/` no importa de `application/`, `infrastructure/`, ni de NestJS/Prisma.
- `application/` importa solo de `domain/` (interfaces).
- `infrastructure/` y `presentation/` importan de `domain/` y `application/`.
- Cross-bounded-context: solo a través de `published-language/` (módulo expuesto).

## Consequences

**Positivas**:

- Domain testeable sin contenedor, sin Nest, sin Prisma — tests unitarios rápidos.
- Swap de Prisma por otra cosa = reescribir solo `infrastructure/persistence`.
- Use cases son la API de negocio — fáciles de listar/auditar.
- Bounded contexts permiten extraer microservicios después si se necesita.

**Negativas / mitigaciones**:

- **Verbosidad**: más archivos por feature que un service-controller plano. Mitigación: scaffold con plantillas (`hygen` o `nest g`).
- **Curva de aprendizaje**: developers junior tienden a "saltarse" capas. Mitigación: docs en [`02-ddd-building-blocks.md`](../../architecture/02-ddd-building-blocks.md) y revisar en code review.
- **Mapping DTO ↔ Domain ↔ Persistence**: tres representaciones del mismo concepto. Mitigación: convención clara y mappers explícitos (no automapper mágico).

**Cuándo NO seguir esto**:

- CRUD trivial sin reglas de negocio: un controller-service-prisma directo está bien. No forzar el modelo si no aporta. La regla aplica para bounded contexts con invariantes (auth, billing, scheduling, etc.).

## Referencias

- Cockburn — _Hexagonal Architecture_ (2005).
- Vernon — _Implementing Domain-Driven Design_.
- `Sairyss/domain-driven-hexagon` (GitHub) — referencia TypeScript de patrones.
