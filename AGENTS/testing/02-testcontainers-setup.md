# 02 — Testcontainers setup

## Por qué

DB mocks divergen de prod (problema histórico de tests verdes con migrations rotas en prod). Testcontainers da una Postgres real efímera, mismo motor que prod, sin mantener un servidor compartido.

## Helpers reutilizables

```ts
// test/helpers/postgres.ts
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';

let container: StartedPostgreSqlContainer | null = null;

export async function startPostgres(): Promise<StartedPostgreSqlContainer> {
  if (container) return container;
  container = await new PostgreSqlContainer('postgres:17-alpine')
    .withDatabase('test')
    .withUsername('test')
    .withPassword('test')
    .start();
  process.env.DATABASE_URL = container.getConnectionUri();
  return container;
}

export async function stopPostgres() {
  if (container) {
    await container.stop({ remove: true });
    container = null;
  }
}
```

```ts
// test/helpers/redis.ts
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';

let container: StartedRedisContainer | null = null;

export async function startRedis() {
  if (container) return container;
  container = await new RedisContainer('redis:7-alpine').start();
  process.env.REDIS_URL = container.getConnectionUrl();
  return container;
}

export async function stopRedis() {
  if (container) {
    await container.stop({ remove: true });
    container = null;
  }
}
```

## Jest globalSetup / globalTeardown

```ts
// test/jest.global-setup.ts
import { startPostgres, startRedis } from './helpers/containers';
import { execSync } from 'node:child_process';

export default async function () {
  await startPostgres();
  await startRedis();
  execSync('pnpm prisma migrate deploy', { stdio: 'inherit' });
  execSync('pnpm prisma db seed', { stdio: 'inherit' });
}
```

```ts
// test/jest.global-teardown.ts
import { stopPostgres, stopRedis } from './helpers/containers';

export default async function () {
  await stopPostgres();
  await stopRedis();
}
```

```jsonc
// jest.config.ts
{
  "globalSetup": "<rootDir>/test/jest.global-setup.ts",
  "globalTeardown": "<rootDir>/test/jest.global-teardown.ts",
  "testTimeout": 60000, // pull image first time
}
```

## Aislar tests entre sí

Cada test debe partir con DB en estado conocido. Tres opciones, en orden de preferencia:

1. **Truncate en `beforeEach`** (rápido, mismo container):

   ```ts
   beforeEach(async () => {
     await prisma.truncateAllForTests();
     await prisma.$executeRaw`SELECT setval('"User_id_seq"', 1, false)`;
     // re-seed minimal
   });
   ```

2. **Transaction rollback** (para algunos tests, no soporta transacciones anidadas reales):

   ```ts
   beforeEach(async () => {
     await prisma.$executeRaw`BEGIN`;
   });
   afterEach(async () => {
     await prisma.$executeRaw`ROLLBACK`;
   });
   ```

   Limitación: si el código bajo test usa transacciones, esto interfiere.

3. **Container per suite** (lento, pero aislamiento total):
   ```ts
   beforeAll(async () => {
     container = await startPostgres();
   });
   afterAll(async () => {
     await container.stop();
   });
   ```

Recomendación: **option 1** (truncate) por defecto.

## CI

```yaml
# .github/workflows/test.yml
- name: Cache testcontainers images
  uses: actions/cache@v4
  with:
    path: ~/.testcontainers/images
    key: tc-${{ runner.os }}-postgres17-redis7

- run: pnpm test:integration
```

Para evitar pull repetido, GitHub Actions con runners persistentes o cache de Docker layers.

## Local dev

```sh
pnpm test:integration
# primer run: pulls postgres:17-alpine + redis:7-alpine (~120MB)
# subsequent: <2s startup
```

Ryuk container (Testcontainers cleanup daemon) garantiza que containers se limpian si el proceso se mata abruptamente.

## Common pitfalls

- **Port conflicts**: Testcontainers asigna puerto random; nunca hardcodear `5432`.
- **Connection pooling**: tests con `await` sin `$disconnect` causan timeouts. Asegurar `app.close()` en `afterAll`.
- **Image not pinned**: usar tag específico (`postgres:17-alpine`), no `:latest`.
- **Slow first run**: documentar en README ("primer test:integration tarda ~30s").

## Mocking external services

Servicios HTTP externos (mailer, OAuth) mockear con `nock` o `msw` — Testcontainers es para infra (DB, queue, cache), no para integraciones third-party.

```ts
import nock from 'nock';

beforeEach(() => {
  nock('https://oauth2.googleapis.com')
    .post('/token')
    .reply(200, { access_token: 'fake', id_token: 'fake' });
});
```
