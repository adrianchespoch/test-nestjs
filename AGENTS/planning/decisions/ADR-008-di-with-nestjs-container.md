# ADR-008 — DI: contenedor de NestJS en application layer (acoplamiento consciente)

**Status**: Accepted (Mayo 2026)

## Context

El skeleton aplica Hexagonal + DDD (ADR-002). El ideal teórico es que **`domain/` y `application/` sean 100% framework-agnostic**: si mañana cambias NestJS por Hono / Fastify standalone / AWS Lambda, no tocas más que la capa de presentation y los adapters de infrastructure.

Para inyectar dependencias en los use cases hay tres caminos posibles:

1. **Contenedor de NestJS** (decoradores `@Injectable` + `@Inject(TOKEN)` en los use cases). Es lo que hace el ecosistema Nest por default y lo que documenta la oficial Prisma + NestJS recipe.
2. **Container externo agnóstico** (`tsyringe`, `awilix`, `inversify`). La application layer queda pura; Nest se usa solo para HTTP/middleware/guards y delega la resolución al container externo.
3. **Composition root manual** (sin contenedor en application; cada `*.module.ts` cablea via `useFactory: (deps) => new UseCase(deps)`).

Trade-offs reales:

| Opción               | Pureza application          | Esfuerzo upfront            | Coste si querés cambiar de framework | Tooling DX                             |
| -------------------- | --------------------------- | --------------------------- | ------------------------------------ | -------------------------------------- |
| 1. Nest container    | 🟡 acoplada via decoradores | mínimo                      | medio (find-replace de `@Inject`)    | óptimo (lo que la comunidad documenta) |
| 2. Container externo | ✅ pura                     | medio                       | bajo                                 | dos contenedores conviviendo           |
| 3. Composition root  | ✅ pura                     | alto (factory por use case) | bajo                                 | pierde resolución automática           |

## Decision

**Adoptamos la opción 1: usamos el contenedor de NestJS también para `application/`** — los use cases tienen `@Injectable()` y `@Inject(SYMBOL)`.

### Lo que **sí** está acoplado a NestJS

- `application/use-cases/*.ts` importan `Inject, Injectable` de `@nestjs/common`.
- Los constructors usan `@Inject(SYMBOL)` para resolver ports.

### Lo que **no** está acoplado (preservado)

- **Domain layer 100% pura**: cero `@nestjs`, cero `@prisma`, cero `@Injectable` en entities, VOs, events, errors, `domain/ports/*`. Verificado por ESLint `boundaries/element-types` (build cae si alguien lo viola).
- **Ports son `interface` puras** + un `Symbol` exportado. El `Symbol` solo existe como token DI; la interface no lleva metadata de Nest.
- **Tests unitarios no usan `Test.createTestingModule`**: construyen los use cases con `new LoginUseCase(mockUsers, mockHasher, ...)` y mocks manuales. Las 109 specs lo demuestran. Esto prueba que la lógica del use case es framework-independiente; solo la **resolución** lo es.
- **El `execute()` body** de cada use case es TypeScript estándar — `Result<T, E>`, llamadas a ports, `await`. Cero referencias a Nest.

### Por qué no las otras opciones

- **Container externo (`tsyringe` etc.)**: agrega un segundo contenedor que coexiste con el de Nest (presentation tiene que seguir usando Nest para guards/interceptors). El payoff (pureza teórica) es bajo si nunca cambias de framework, y el costo (dos sistemas de resolución, doble configuración) es real cada día.
- **Composition root manual**: pierdo resolución transitiva automática. Cada `useFactory` tiene que listar todas las deps; un cambio en el constructor de un use case requiere editar el `*.module.ts`. Costo continuo alto vs. beneficio teórico.

## Consequences

### Positivas

- **Toolkit Nest funciona out-of-the-box**: `Test.createTestingModule()`, `useExisting`/`useFactory`, lifecycle hooks (`OnModuleInit`/`OnModuleDestroy`), scopes, etc. Sin reescribir nada.
- **Onboarding más bajo**: cualquier dev con experiencia NestJS reconoce el patrón inmediato.
- **Tests siguen siendo agnósticos**: las suites unit instancian use cases con `new` y mocks. La unidad bajo test no necesita el contenedor de Nest para correr.
- **Domain layer queda como puerto de huida**: si en el futuro hay que cambiar de framework, el dominio se mueve tal cual; aplicación pierde solo los decoradores.

### Negativas y mitigaciones

- **Acoplamiento parcial application↔NestJS**: sí, existe via decoradores. Mitigación: documentado aquí, es consciente y delimitado a un único patrón (`@Inject(SYMBOL)`). Reemplazarlo es find-replace mecánico, no un rewrite.
- **`@Injectable()` en use cases puede tentar a "subir" responsabilidades de presentation a application** (logger del framework, request scope, etc.). Mitigación: code review + las reglas ESLint boundaries siguen prohibiendo importar de `presentation/` o `infrastructure/` desde `application/`.
- **Symbols viven en `domain/ports/`**: si bien técnicamente son una concesión al contenedor DI, tipográficamente conviven con la interface a la que pertenecen. Es razonable porque el `Symbol` es la "identidad" del puerto.

### Reglas que la decisión NO afloja

- `domain/` sigue **prohibido** importar `@nestjs/*`. ESLint boundaries lo enforce.
- Use cases **NO** acceden a `Logger`, `ConfigService` ni nada `from '@nestjs/...'` excepto `Inject`/`Injectable`. Si necesitan logging, lo hacen via un port (`ILogger`) no via el logger del framework.
- Use cases **NO** lanzan excepciones HTTP (`HttpException`, `BadRequestException`). Errores como valores en `Result.Err`. El controller mapea a HTTP.

## Plan B documentado (si la realidad cambia)

Si aparece un caso de uso que justifique remover el acoplamiento (multi-runtime: Lambda + Nest, o reuso de use cases en CLI/worker fuera de Nest), el camino de migración es:

1. Reemplazar `@Inject(SYMBOL)` por parámetros de constructor planos.
2. En cada `*.module.ts`, cablear con `useFactory: (...deps) => new UseCase(...deps)`.
3. Los Symbols se mantienen — solo cambia su uso en el module, no en el use case.
4. Eliminar `@Injectable()` de los use cases.

Coste estimado: ~20 use cases × 5 minutos = ~2 horas de refactor mecánico + tests siguen pasando sin cambios.

## Referencias

- ADR-002 — Arquitectura hexagonal con building blocks DDD
- ADR-005 — CASL para RBAC + ABAC (sigue el mismo patrón Inject port → adapter)
- NestJS docs — Custom providers (`useExisting`, `useFactory`, `useValue`)
- `eslint.config.mjs` — `boundaries/element-types` rules que enforcen las capas
- Discusión interna 2026-05-03 (en `AGENTS/PROGRESS.md`)
