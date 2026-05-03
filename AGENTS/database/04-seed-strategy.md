# 04 — Seed strategy

## Distintos seeds para distintos propósitos

| Tipo            | Cuándo                     | Idempotente | Ejemplos                                           |
| --------------- | -------------------------- | ----------- | -------------------------------------------------- |
| **System seed** | Boot inicial + cada deploy | Sí          | Roles `superadmin`, permisos canónicos, tipos enum |
| **Dev seed**    | `pnpm db:seed:dev`         | Sí          | 50 users fake, 200 posts, datos para UI demo       |
| **Test seed**   | Cada suite                 | Sí          | Fixtures mínimas por test (preferir factories)     |
| **Demo seed**   | Ambiente de demo público   | Sí          | Usuario showroom con permisos limitados            |

## System seed — obligatorio en boot

Aplica datos que **el código asume que existen** (ej. roles del sistema). Falla el boot si no se puede aplicar.

```ts
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function seedSystemRoles() {
  await prisma.role.upsert({
    where: { name: 'superadmin' },
    update: {},
    create: { name: 'superadmin', isSystem: true, description: 'Full access' },
  });

  await prisma.role.upsert({
    where: { name: 'user' },
    update: {},
    create: { name: 'user', isSystem: true, description: 'Default role' },
  });
}

async function seedSystemPermissions() {
  const perms = [
    { action: 'manage', subject: 'all' },
    { action: 'read', subject: 'User' },
    { action: 'update', subject: 'User', conditions: { id: '$user.id' } },
    // ...
  ];
  for (const p of perms) {
    await prisma.permission.upsert({
      where: { action_subject: { action: p.action, subject: p.subject } },
      update: { conditions: p.conditions ?? null },
      create: p,
    });
  }
}

async function main() {
  await seedSystemRoles();
  await seedSystemPermissions();
  // wire superadmin → manage:all
  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        /* lookup */
      },
    },
    update: {},
    create: {
      /* ... */
    },
  });
}

main().finally(() => prisma.$disconnect());
```

`package.json`:

```jsonc
"prisma": { "seed": "tsx prisma/seed.ts" }
```

Ejecutado en CI/CD como step posterior a `migrate deploy`.

## Dev seed — opt-in

Solo para developer experience local. Nunca debería correr en prod.

```ts
// prisma/seed-dev.ts
async function main() {
  if (process.env.NODE_ENV !== 'dev') {
    throw new Error('seed-dev is dev-only');
  }
  // crea 50 users, 200 posts, etc.
}
```

Ejecutar con:

```sh
NODE_ENV=dev pnpm tsx prisma/seed-dev.ts
```

## Idempotencia

**Toda** seed debe poder correrse N veces sin daño:

- Usar `upsert`, no `create`.
- Para datos de prueba (dev), usar IDs determinísticos (`uuid` desde semilla `faker.seed(123)`) o claves naturales.
- Si una seed crea relaciones, manejar el caso "ya existe".

## Test factories (no seeds)

Para tests preferimos **factories** sobre seeds globales:

```ts
// test/factories/user.factory.ts
export const userFactory = (overrides: Partial<UserCreateInput> = {}) => ({
  email: faker.internet.email(),
  name: faker.person.fullName(),
  passwordHash: '$argon2id$...$test_hash',
  ...overrides,
});

// uso en test
const user = await prisma.user.create({ data: userFactory({ email: 'fixed@example.com' }) });
```

Ventajas:

- Cada test crea solo lo que necesita.
- Sin estado compartido entre tests.
- Datos descriptivos del intent del test.

Ver [`testing/03-fixtures-and-factories.md`](../testing/03-fixtures-and-factories.md).

## Order of operations en prod deploy

```
1. migrate deploy
2. seed (system only)
3. health check
4. swap traffic to new pods
```

Si la seed falla, el deploy falla — la app vieja sigue sirviendo.

## Reset

```sh
# Solo en dev/test
pnpm prisma migrate reset --force --skip-generate
# equivalente a: drop schema → migrate deploy → seed
```

Nunca en prod. Si lo necesitas en prod, no es un reset — es un incidente.
