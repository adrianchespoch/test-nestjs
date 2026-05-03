# 03 — Folder layout propuesto

```
src/
├── main.ts                              # bootstrap: OTel → Nest → middlewares → listen
├── otel.ts                              # init OTel SDK (importado primero en main.ts)
├── app.module.ts                        # raíz: importa shared + bounded contexts
│
├── shared/                              # kernel: reusable, pure or thin infra
│   ├── domain/
│   │   ├── result.ts                    # Result<T, E> (sin throw)
│   │   ├── entity.ts
│   │   ├── aggregate-root.ts
│   │   ├── value-object.ts
│   │   ├── domain-event.ts
│   │   ├── specification.ts
│   │   └── errors/
│   │       └── domain.error.ts
│   ├── application/
│   │   ├── use-case.ts                  # base: execute(input): Promise<Result>
│   │   ├── event-bus.port.ts            # IEventBus (driven port)
│   │   ├── clock.port.ts                # IClock (testeable)
│   │   ├── unit-of-work.port.ts
│   │   └── filters/
│   │       └── domain-exception.filter.ts
│   ├── infrastructure/
│   │   ├── prisma/
│   │   │   ├── prisma.service.ts
│   │   │   └── prisma.module.ts
│   │   ├── redis/
│   │   │   ├── redis.service.ts
│   │   │   └── redis.module.ts
│   │   ├── event-bus/
│   │   │   └── in-memory-event-bus.ts   # adapter de IEventBus
│   │   ├── clock/
│   │   │   └── system-clock.ts
│   │   └── otel/
│   │       └── tracing.decorator.ts
│   └── presentation/
│       ├── interceptors/
│       │   ├── correlation-id.interceptor.ts
│       │   └── transform-result.interceptor.ts
│       ├── pipes/
│       └── decorators/
│           └── current-user.decorator.ts
│
├── modules/                             # bounded contexts
│   │
│   ├── auth/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── session.ts
│   │   │   │   └── refresh-token.ts
│   │   │   ├── value-objects/
│   │   │   │   ├── email.ts
│   │   │   │   ├── password.ts
│   │   │   │   ├── hashed-password.ts
│   │   │   │   └── token-family.ts
│   │   │   ├── events/
│   │   │   │   ├── user-logged-in.ts
│   │   │   │   ├── refresh-token-rotated.ts
│   │   │   │   └── refresh-token-reuse-detected.ts
│   │   │   ├── services/
│   │   │   │   ├── account-lockout.policy.ts
│   │   │   │   └── token-rotation.service.ts
│   │   │   ├── ports/
│   │   │   │   ├── session.repository.ts
│   │   │   │   ├── hasher.port.ts
│   │   │   │   ├── jwt-signer.port.ts
│   │   │   │   ├── email-sender.port.ts
│   │   │   │   └── oauth-provider.port.ts
│   │   │   └── errors/
│   │   ├── application/
│   │   │   └── use-cases/
│   │   │       ├── register-user.use-case.ts
│   │   │       ├── login.use-case.ts
│   │   │       ├── refresh-token.use-case.ts
│   │   │       ├── logout.use-case.ts
│   │   │       ├── request-password-reset.use-case.ts
│   │   │       ├── reset-password.use-case.ts
│   │   │       ├── verify-email.use-case.ts
│   │   │       └── oauth-callback.use-case.ts
│   │   ├── infrastructure/
│   │   │   ├── persistence/
│   │   │   │   ├── prisma-session.repository.ts
│   │   │   │   └── mappers/
│   │   │   ├── crypto/
│   │   │   │   ├── argon-hasher.ts
│   │   │   │   └── jwt-signer.ts
│   │   │   ├── mailer/
│   │   │   │   └── nodemailer-adapter.ts
│   │   │   └── oauth/
│   │   │       ├── google-oauth.adapter.ts
│   │   │       └── github-oauth.adapter.ts
│   │   ├── presentation/
│   │   │   ├── controllers/
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── oauth-google.controller.ts
│   │   │   │   └── oauth-github.controller.ts
│   │   │   ├── dtos/
│   │   │   ├── guards/
│   │   │   │   └── jwt-auth.guard.ts
│   │   │   └── strategies/
│   │   │       ├── jwt.strategy.ts
│   │   │       ├── google.strategy.ts
│   │   │       └── github.strategy.ts
│   │   └── auth.module.ts
│   │
│   ├── users/
│   │   ├── domain/                      # User aggregate vive aquí (auth lo lee vía port cross-context)
│   │   ├── application/
│   │   ├── infrastructure/
│   │   ├── presentation/
│   │   └── users.module.ts
│   │
│   ├── rbac/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── role.ts
│   │   │   │   └── permission.ts
│   │   │   ├── value-objects/
│   │   │   ├── ports/
│   │   │   │   └── permission-checker.port.ts   # abstracción CASL
│   │   │   └── services/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   │   └── casl/
│   │   │       ├── ability.factory.ts
│   │   │       └── casl-permission-checker.ts
│   │   ├── presentation/
│   │   │   └── guards/
│   │   │       └── policies.guard.ts
│   │   └── rbac.module.ts
│   │
│   └── health/
│       ├── health.controller.ts
│       └── health.module.ts
│
└── config/
    ├── env.schema.ts                    # Joi schema validando process.env
    ├── app.config.ts
    └── jwt.config.ts

prisma/
├── schema.prisma
├── migrations/                          # generated por prisma migrate
└── seed.ts

test/
├── unit/                                # mirror de src/, sin DB
├── integration/                         # uses Testcontainers Postgres + Redis
├── e2e/                                 # supertest contra app completa
├── fixtures/
└── factories/
```

## Reglas de imports (forzadas por ESLint)

`eslint-plugin-boundaries` con elementos:

```jsonc
{
  "settings": {
    "boundaries/elements": [
      { "type": "shared", "pattern": "src/shared/*" },
      { "type": "domain", "pattern": "src/modules/*/domain/**" },
      { "type": "app", "pattern": "src/modules/*/application/**" },
      { "type": "infra", "pattern": "src/modules/*/infrastructure/**" },
      { "type": "present", "pattern": "src/modules/*/presentation/**" },
    ],
  },
  "rules": {
    "boundaries/element-types": [
      "error",
      {
        "default": "disallow",
        "rules": [
          { "from": "domain", "allow": ["domain", "shared"] },
          { "from": "app", "allow": ["domain", "app", "shared"] },
          { "from": "infra", "allow": ["domain", "app", "infra", "shared"] },
          { "from": "present", "allow": ["domain", "app", "present", "shared"] },
        ],
      },
    ],
  },
}
```

## Cross-bounded-context

Cuando `auth/` necesita leer `User` que vive en `users/`:

- `auth/domain/ports/user-lookup.port.ts` define la interface mínima necesaria.
- `users/infrastructure/published/user-lookup.adapter.ts` la implementa exponiendo solo lo que auth necesita.
- En `app.module.ts` se cablea.

No hay imports cruzados directos entre `modules/auth` y `modules/users`.
