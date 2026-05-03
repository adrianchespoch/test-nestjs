# 01 — Hexagonal architecture overview

> Contexto: ver [`ADR-002`](../planning/decisions/ADR-002-hexagonal-with-ddd.md).

## El modelo en una imagen mental

```
                         ┌──────────────────────────┐
   Driving adapters      │                          │       Driven adapters
   (HTTP, GraphQL, CLI,  │       DOMAIN +           │       (Prisma, Redis,
    Queue consumer)      │     APPLICATION          │        Argon, OAuth,
                         │                          │        Mailer, S3)
       ─── call ───►    [driving ports]    [driven ports]    ◄─── implement ───
                         │                          │
                         └──────────────────────────┘
```

- **Driving ports** = interfaces que el mundo exterior **llama** para activar el dominio. En la práctica son los **use cases** (`LoginUseCase.execute(input)`).
- **Driven ports** = interfaces que el dominio **necesita** del exterior para hacer su trabajo. Ejemplos: `IUserRepository`, `IHasher`, `IEmailSender`, `IClock`.
- **Adapters driving** = traducen entrada externa al lenguaje del dominio. Ejemplo: `AuthController` recibe HTTP, valida DTO, llama `LoginUseCase`.
- **Adapters driven** = implementan los driven ports con tecnología concreta. Ejemplo: `PrismaUserRepository implements IUserRepository`.

## Reglas de oro

1. **El dominio no sabe de Nest, Prisma, ni HTTP**. Importa solo TypeScript estándar y otras piezas del propio dominio.
2. **Use cases orquestan**, no implementan. Llaman a entidades y servicios de dominio.
3. **Los adapters dependen del dominio**, no al revés. La regla de dependencia apunta hacia adentro.
4. **Una capa nunca salta**: presentation no llama a infrastructure directo; pasa por application.

## Dependency Inversion en NestJS

NestJS provee DI nativo, lo aprovechamos:

```ts
// domain/repositories/user.repository.ts
export interface IUserRepository {
  findByEmail(email: Email): Promise<User | null>;
  save(user: User): Promise<void>;
}
export const USER_REPOSITORY = Symbol('IUserRepository');

// infrastructure/persistence/prisma-user.repository.ts
@Injectable()
export class PrismaUserRepository implements IUserRepository {
  /* ... */
}

// auth.module.ts
providers: [{ provide: USER_REPOSITORY, useClass: PrismaUserRepository }, LoginUseCase];

// application/use-cases/login.use-case.ts
@Injectable()
export class LoginUseCase {
  constructor(@Inject(USER_REPOSITORY) private users: IUserRepository) {}
}
```

El use case depende de la abstracción, Nest cablea la implementación.

## Driving adapter típico (HTTP)

```ts
// presentation/http/controllers/auth.controller.ts
@Controller('auth')
export class AuthController {
  constructor(private login: LoginUseCase) {}

  @Post('login')
  async loginEndpoint(@Body() dto: LoginDto, @Res({ passthrough: true }) res) {
    const result = await this.login.execute({ email: dto.email, password: dto.password });
    if (result.isErr()) throw mapDomainError(result.error);
    res.cookie('refresh', result.value.refresh, REFRESH_COOKIE_OPTS);
    return { accessToken: result.value.access };
  }
}
```

El controller es **delgado**: traduce HTTP → input del use case y resultado → respuesta HTTP. Sin lógica de negocio.

## Driven port típico

```ts
// domain/services/hasher.port.ts
export interface IHasher {
  hash(plain: string): Promise<HashedPassword>;
  verify(plain: string, hashed: HashedPassword): Promise<boolean>;
}

// infrastructure/auth/argon-hasher.ts
@Injectable()
export class ArgonHasher implements IHasher {
  async hash(plain: string) {
    return argon2.hash(plain, ARGON_PARAMS) as Promise<HashedPassword>;
  }
  verify(plain: string, hashed: HashedPassword) {
    return argon2.verify(hashed, plain);
  }
}
```

Si mañana cambiamos a scrypt, reemplazamos `ArgonHasher` y nada más se mueve.

## Cuándo no aplicar hexagonal

CRUD trivial sin invariantes (un `notes` con get/create/delete sin reglas) puede ir como controller-service-repo plano dentro del bounded context. Hexagonal aporta cuando hay reglas de negocio que merecen aislarse.

## Anti-patterns a evitar

- **Anemic domain**: entities con solo getters/setters. Las invariantes viven en el dominio (`User.changePassword(newPwd)`, no `userService.setPassword(user, pwd)`).
- **Repository "fat"**: métodos como `findUsersWithUnpaidInvoicesAndRoleAdmin`. Repos exponen verbos básicos; las queries específicas usan **specifications** o `accessibleBy(ability)` (ver [05-design-patterns-catalog.md](./05-design-patterns-catalog.md)).
- **Domain calling Nest decorators**: si necesitas `@Injectable` en una entidad, algo está mal.
