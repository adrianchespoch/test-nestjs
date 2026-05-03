# 03 — Fixtures & factories (Object Mother + faker)

## Filosofía

- **Factory**: función que crea un objeto con valores razonables por defecto, override opcional.
- **Object Mother**: factory con presets nombrados para casos específicos del dominio.
- **No fixture JSON files**: difíciles de mantener, no leen el dominio actual.

## Estructura

```
test/
├── factories/
│   ├── user.factory.ts
│   ├── role.factory.ts
│   ├── refresh-token.factory.ts
│   └── ...
├── object-mothers/
│   ├── auth.mother.ts        # presets: verifiedUser, lockedUser, unverifiedUser
│   └── rbac.mother.ts        # presets: admin, viewer, ownerOnlyEditor
└── helpers/
    ├── containers.ts
    └── http.ts
```

## Factory básica

```ts
// test/factories/user.factory.ts
import { faker } from '@faker-js/faker';
import { PrismaService } from '@/shared/infrastructure/prisma/prisma.service';
import { argon2id } from '@/shared/infrastructure/crypto/argon-hasher';

export const userFactory = (overrides: Partial<UserCreateInput> = {}): UserCreateInput => ({
  email: faker.internet.email().toLowerCase(),
  name: faker.person.fullName(),
  passwordHash: '$argon2id$v=19$m=65536,t=3,p=1$...$placeholder', // hash dummy
  emailVerifiedAt: new Date(),
  ...overrides,
});

export const persistUser = async (
  prisma: PrismaService,
  overrides: Partial<UserCreateInput> = {},
) => {
  return prisma.user.create({ data: userFactory(overrides) });
};
```

## Object Mother

```ts
// test/object-mothers/auth.mother.ts
import { persistUser } from '../factories/user.factory';

export class AuthMother {
  constructor(private prisma: PrismaService) {}

  /** Verified, with default 'user' role, password 'Password123!' (real argon2 hash precomputed) */
  async verifiedUser(opts: { email?: string } = {}) {
    return persistUser(this.prisma, {
      email: opts.email ?? faker.internet.email(),
      passwordHash: TEST_HASH_FOR_PASSWORD123,
      emailVerifiedAt: new Date(),
    });
  }

  async unverifiedUser() {
    return persistUser(this.prisma, { emailVerifiedAt: null });
  }

  async lockedUser() {
    return persistUser(this.prisma, {
      lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
      failedLoginAttempts: 5,
    });
  }

  async admin() {
    const user = await this.verifiedUser();
    const role = await this.prisma.role.findUniqueOrThrow({ where: { name: 'superadmin' } });
    await this.prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    return user;
  }
}
```

Uso:

```ts
const mother = new AuthMother(prisma);
const alice = await mother.verifiedUser({ email: 'alice@example.com' });
```

## faker seed

Para tests que dependen de valores estables (ej. snapshot tests), inicializar faker con seed:

```ts
beforeEach(() => faker.seed(42));
```

## TEST_HASH_FOR_PASSWORD123

Para evitar costo de argon2 en cada test (200ms × 1000 tests = 3 min), precomputar un hash de "Password123!" y reusarlo:

```ts
// test/helpers/test-hashes.ts
export const TEST_HASH_FOR_PASSWORD123 = '$argon2id$v=19$m=65536,t=3,p=1$...$realHash';
```

Generado con:

```sh
node -e "import('argon2').then(m => m.hash('Password123!').then(console.log))"
```

Pega el output. Lo verifica el test que asegura "verify(plain, hash) returns true".

Para tests donde el hash se debe **producir** dinámicamente (ej. test del use case Register), usa el hasher real — pocos tests lo necesitan.

## Anti-patterns

- **Factory que retorna instancias parciales sin defaults**: el caller termina llenando todo. Mal — la factory debe ser autosuficiente.
- **Objeto literal repetido en cada test**: refactorizar a factory en cuanto se duplique 3 veces.
- **Side effects en factories** (ej. crear archivos, mandar requests): factories deben ser puras (excepto `persist*` que escribe a DB).
- **Datos compartidos entre tests** (`const ALICE = ...` global): genera coupling. Cada test crea sus propios fixtures.

## Cleanup

Si usas `truncateAllForTests()` en `beforeEach` (recomendado), no necesitas cleanup explícito post-test. Las factories asumen DB limpia al inicio.

## Cross-bounded-context

Si un test de `auth/` necesita un `Role`, importa `RoleFactory` de `test/factories/role.factory.ts` — no busques modelar todo dentro del bounded context.
