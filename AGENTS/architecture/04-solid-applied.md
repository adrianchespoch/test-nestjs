# 04 — SOLID applied

SOLID no es un dogma, son cinco heurísticas. Aquí cómo se manifiestan en este skeleton.

## S — Single Responsibility

Cada use case = un comando o query. **No** hay `AuthService` con 14 métodos. Hay `LoginUseCase`, `LogoutUseCase`, `RefreshTokenUseCase`, etc.

> _"Una clase debe tener una sola razón para cambiar"_. Si modifico el flujo de login, no debería tocar archivos relacionados con logout.

**Anti-pattern detectado**: una clase `UserService` con `register`, `login`, `getProfile`, `updateSettings`, `delete`. Si cambia el formato de logout, el archivo de getProfile aparece en el diff. Mal.

## O — Open/Closed

Extender comportamiento sin modificar código existente: por ejemplo, agregar un nuevo provider OAuth no debería tocar `LoginUseCase` ni los OAuth ya existentes.

**Mecanismo en el skeleton**: `IOAuthProvider` interface con `getAuthUrl(state)`, `exchangeCode(code)`, `fetchProfile(accessToken)`. `GoogleOAuthAdapter` y `GithubOAuthAdapter` implementan. Agregar Microsoft = un archivo nuevo + registrar en module.

## L — Liskov Substitution

Si `IUserRepository` tiene `findByEmail`, **toda** implementación lo respeta sin sorpresas:

- No tira excepciones inesperadas para casos válidos.
- No retorna shapes distintos.
- No tiene side effects ocultos.

**Ejemplo de violación a evitar**: una `InMemoryUserRepository` que para test devuelve usuarios sin tasks anidados, mientras `PrismaUserRepository` los devuelve eagerly. Tests pasan, prod falla.

## I — Interface Segregation

Cliente no debería depender de métodos que no usa. Preferimos **muchas interfaces pequeñas** sobre una grande.

**Aplicado**:

- `IHasher` solo `hash` + `verify`. No tiene `compareHashStrengths()` aunque `argon2` lo soporte.
- `IEmailSender` no expone templates; templates se cargan en el adapter.
- `IUserLookup` (port que `auth/` usa para leer Users) tiene solo `findById` y `findByEmail`. No `update`, `create`, `delete` — eso está en `IUserRepository` interno a `users/`.

## D — Dependency Inversion

Ya cubierto en hexagonal (ver [`01-hexagonal-overview.md`](./01-hexagonal-overview.md)). Resumen:

- Capa alta (use cases) define **ports** (interfaces).
- Capa baja (adapters) los implementa.
- El cableado es responsabilidad del módulo Nest, no del use case.

**Concreto**:

```ts
// MAL: use case depende de Prisma directo
class LoginUseCase {
  constructor(private prisma: PrismaService) {}
}

// BIEN: depende de abstracción del dominio
class LoginUseCase {
  constructor(@Inject(USER_REPOSITORY) private users: IUserRepository) {}
}
```

## Heurística para code review

Si un PR rompe una de estas, el comentario es estándar:

- "Esta clase hace cosas no relacionadas — separar." → S
- "Extender X requirió tocar Y, Z, W. Refactor con strategy/factory." → O
- "Esta override cambia el contrato del padre." → L
- "Esta interface tiene 12 métodos, los consumers solo usan 2." → I
- "Esta capa importa Prisma directo, debería ir vía port." → D

## Lo que no es SOLID

- No es perfectionism. Si una clase tiene 2 responsabilidades pero ninguna crece, déjala.
- No es excusa para crear interfaces de un solo uso. Si `IThing` solo tiene una implementación y nadie planea agregar otra, prefiere clase concreta hasta que el problema aparezca.
