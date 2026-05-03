# 02 — DDD building blocks

Esta es la nomenclatura que usamos dentro de cada bounded context. No usamos DDD estratégico (context maps, ubiquitous language formal) hasta que el dominio lo justifique.

## Entity

Identidad estable, atributos mutables.

```ts
abstract class Entity<TId extends ValueObject> {
  protected readonly _id: TId;
  protected constructor(id: TId) {
    this._id = id;
  }
  get id(): TId {
    return this._id;
  }
  equals(other?: Entity<TId>): boolean {
    return !!other && this._id.equals(other._id);
  }
}
```

## Aggregate Root

Entity que es la **única puerta de entrada** a un cluster de objetos consistentes. Encapsula invariantes que cruzan entidades.

```ts
class User extends AggregateRoot<UserId> {
  private constructor(
    id: UserId,
    private email: Email,
    private password: HashedPassword,
    private status: UserStatus,
    private failedLoginAttempts: number,
  ) {
    super(id);
  }

  static register(email: Email, password: HashedPassword): Result<User, RegisterError> {
    /* ... */
  }

  recordFailedLogin(): void {
    this.failedLoginAttempts += 1;
    if (this.failedLoginAttempts >= 5) this.lock();
  }

  // ...
}
```

Un repository carga/guarda el aggregate completo. Nada externo modifica internals.

## Value Object

Sin identidad, igualdad por valor, **inmutable**.

```ts
class Email extends ValueObject<{ value: string }> {
  static create(raw: string): Result<Email, InvalidEmail> {
    if (!EMAIL_REGEX.test(raw)) return Result.err(new InvalidEmail(raw));
    return Result.ok(new Email({ value: raw.toLowerCase() }));
  }
  get value() {
    return this.props.value;
  }
}
```

VOs típicos en este skeleton: `Email`, `Password` (raw), `HashedPassword`, `UserId`, `RoleName`.

## Repository (interface — driven port)

```ts
interface IUserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  save(user: User): Promise<void>;
}
```

- Métodos verbales, no SQL leak.
- Devuelve aggregates hidratados — nunca DTOs ni rows crudas.
- La implementación Prisma maps row ↔ aggregate vía un Mapper.

## Domain Service

Cuando una operación cruza dos aggregates o no encaja naturalmente en uno, se modela como servicio de dominio. Pure, sin I/O.

```ts
class UniqueEmailPolicy {
  constructor(private users: IUserRepository) {}
  async isAvailable(email: Email): Promise<boolean> {
    return (await this.users.findByEmail(email)) === null;
  }
}
```

## Domain Event

Hechos del pasado del dominio. Inmutables.

```ts
class UserRegistered implements DomainEvent {
  readonly occurredAt = new Date();
  constructor(
    readonly userId: UserId,
    readonly email: Email,
  ) {}
}
```

El aggregate los emite vía `addEvent`. El event bus los publica al guardar el aggregate (o tras commit de UoW).

## Specification

Encapsula una regla de filtrado o validación.

```ts
class IsActiveUserSpec implements Specification<User> {
  isSatisfiedBy(u: User): boolean {
    return u.status === 'active';
  }
}
```

Útil para queries reusables y reglas de validación compuestas (`spec1.and(spec2)`).

## Use Case (capa application)

Orquesta el dominio para satisfacer un comando o query. Un use case = una operación. Sin lógica de dominio adentro — solo coordinación.

```ts
@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private users: IUserRepository,
    @Inject(HASHER) private hasher: IHasher,
    private bus: IEventBus,
  ) {}

  async execute(input: RegisterInput): Promise<Result<UserId, RegisterError>> {
    const email = Email.create(input.email);
    if (email.isErr()) return email;
    if (!(await new UniqueEmailPolicy(this.users).isAvailable(email.value)))
      return Result.err(new EmailAlreadyExists());

    const hashed = await this.hasher.hash(input.password);
    const user = User.register(email.value, hashed);
    if (user.isErr()) return user;

    await this.users.save(user.value);
    await this.bus.publish(user.value.pullEvents());
    return Result.ok(user.value.id);
  }
}
```

## Mapper

Traduce entre representaciones (Domain ↔ Persistence row, Domain ↔ DTO).

```ts
class UserMapper {
  static toPersistence(u: User): Prisma.UserCreateInput {
    /* ... */
  }
  static toDomain(row: User_DB): User {
    /* ... */
  }
  static toDTO(u: User): UserResponseDto {
    /* ... */
  }
}
```

Tres mappers separados, no uno mágico. Cada conversión tiene reglas distintas (qué se expone, qué se persiste).

## Lo que NO hacemos

- **Saga / Process Manager**: hasta que aparezca un workflow real con compensaciones. No anticipar.
- **Ubiquitous language formal**: si los términos del código coinciden con lo que dice el equipo en standup, está bien. Glosario formal solo si hay confusión.
- **Generic repositories**: cada repo es específico de su aggregate. Nada de `Repository<T>` con métodos auto-generados.
