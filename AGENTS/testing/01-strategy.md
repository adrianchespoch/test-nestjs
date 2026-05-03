# 01 — Testing strategy

## Pirámide

```
          /\
         /e2e\     ~10% — supertest + app real + Postgres + Redis Testcontainers
        /------\
       / int.   \  ~20% — module slices, real DB en container, mocks externos (HTTP, mailer)
      /----------\
     /   unit     \ ~70% — domain pure, use cases con repos in-memory, sin I/O
    /--------------\
```

Proporción aproximada en commits — no es regla rígida. Lo importante: la mayoría rápida, la minoría comprehensiva.

## Tipos

### Unit

- Solo dominio + use cases.
- Repos in-memory (`InMemoryUserRepository implements IUserRepository`).
- Sin Nest, sin DB, sin red.
- Run time objetivo: < 50ms por test.
- Cobertura objetivo: 90%+ del código de `src/modules/*/domain/` y `src/modules/*/application/`.

```ts
// test/unit/auth/login.use-case.spec.ts
describe('LoginUseCase', () => {
  let users: InMemoryUserRepository;
  let hasher: FakeHasher;
  let sut: LoginUseCase;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    hasher = new FakeHasher();
    sut = new LoginUseCase(users, hasher /* ... */);
  });

  it('returns Ok with tokens for valid credentials', async () => {
    const user = await UserFactory.persisted(users, { email: 'a@x.com', password: 'p' });
    const result = await sut.execute({ email: 'a@x.com', password: 'p' });
    expect(result.isOk()).toBe(true);
  });

  it('returns Err INVALID_CREDENTIALS for wrong password', async () => {
    /* ... */
  });
});
```

### Integration

- Slice de un bounded context con DB real (Testcontainers).
- Adapters reales (Prisma, Redis, Argon).
- Externos mockeados (mailer, OAuth providers).
- Run time objetivo: < 5s por test.

```ts
// test/integration/auth/register.integration.spec.ts
describe('Register flow (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    await postgresContainer.start();
    await redisContainer.start();
    process.env.DATABASE_URL = postgresContainer.url;
    app = await Test.createTestingModule({ imports: [AppModule] })
      .compile()
      .createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.$executeRaw`...migrate...`;
  }, 60_000);

  afterAll(async () => {
    await app.close();
    await postgresContainer.stop();
  });

  beforeEach(() => prisma.truncateAllForTests());

  it('persists user with argon2id hash', async () => {
    /* ... */
  });
});
```

### E2E

- App real, HTTP via supertest.
- Cubre escenarios completos de las features Gherkin.
- Mockear solo lo que mata performance o tiene side effects irreversibles (envío de email real, OAuth con provider real).

```ts
// test/e2e/auth.e2e-spec.ts
describe('Auth E2E', () => {
  it('full register → verify → login → refresh → logout', async () => {
    // POST /auth/register
    // mailer captura el token
    // GET /auth/verify
    // POST /auth/login
    // POST /auth/refresh
    // POST /auth/logout
  });
});
```

## Mapping Gherkin → tests

Cada `.feature` se traduce a un `*.e2e-spec.ts` con un test por scenario. Si el equipo adopta Cucumber.js como runner, `.feature` se ejecutan directamente; si no, los scenarios sirven como spec narrativa y los tests Jest los implementan.

## What NOT to test

- Getters/setters triviales.
- Configuración de NestJS (que el module compile = está cubierto por boot).
- Implementaciones de librerías externas (no testear que `argon2.hash` realmente hashea).

## Flaky tests

**Política**: un test flaky se quarantine al primer falso positivo y se arregla o se borra en 1 semana. No tolerar verde-rojo aleatorio.

Causas comunes en este stack:

- **Tiempo**: usar `IClock` injectable, nunca `new Date()` directo en use cases.
- **Concurrencia**: tests en paralelo con DB compartida — usar Testcontainers por suite o `--runInBand` para suites con state.
- **Red flaky**: mockear, no llamar a internet en CI.

## CI

```yaml
# .github/workflows/test.yml (extracto)
test:unit:
  run: pnpm test:unit
test:integration:
  services: { postgres: ..., redis: ... }
  run: pnpm test:integration
test:e2e:
  run: pnpm test:e2e --runInBand
```

Tres jobs separados → fail fast (unit primero).

## Performance budget

Suite total objetivo: < 2 min en CI. Si pasa de 5 min, audit y romper:

- Promover de e2e a integration cuando posible.
- Promover de integration a unit cuando posible.
- Paralelizar (CI matrix).
