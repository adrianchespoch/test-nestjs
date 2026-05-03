# 01 — Config & secrets (12-factor)

## Principios

- **Config en env vars**, no en archivos versionados.
- **Validación al boot**: si falta o es inválido, app falla rápido — no inicia con valores default inseguros.
- **Secrets nunca en imagen Docker** ni en logs.
- **Una imagen, múltiples ambientes**: misma binary corre en dev/staging/prod, solo cambia config.

## Validación con Joi

```ts
// src/config/env.schema.ts
import * as Joi from 'joi';

export const envSchema = Joi.object({
  // Runtime
  NODE_ENV: Joi.string().valid('dev', 'test', 'staging', 'prod').required(),
  PORT: Joi.number().port().default(3000),
  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace').default('info'),
  HOST: Joi.string().default('0.0.0.0'),

  // Database
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),

  // Redis
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .required(),
  REDIS_REQUIRED: Joi.boolean().default(true),

  // JWT
  JWT_PRIVATE_KEY: Joi.string().required(), // PEM RS256
  JWT_PUBLIC_KEY: Joi.string().required(),
  JWT_ACCESS_TTL_SEC: Joi.number().default(900),
  JWT_REFRESH_TTL_SEC: Joi.number().default(2592000),

  // Cookies
  COOKIE_SECRET: Joi.string().min(32).required(),
  COOKIE_DOMAIN: Joi.string().required(),
  COOKIE_SAMESITE: Joi.string().valid('Strict', 'Lax', 'None').default('Strict'),

  // OAuth Google
  GOOGLE_CLIENT_ID: Joi.string().required(),
  GOOGLE_CLIENT_SECRET: Joi.string().required(),
  GOOGLE_CALLBACK_URL: Joi.string().uri().required(),

  // OAuth GitHub
  GITHUB_CLIENT_ID: Joi.string().required(),
  GITHUB_CLIENT_SECRET: Joi.string().required(),
  GITHUB_CALLBACK_URL: Joi.string().uri().required(),

  // CORS
  CORS_ORIGINS: Joi.string().required(), // comma-separated whitelist

  // Mailer
  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().port().required(),
  SMTP_USER: Joi.string().required(),
  SMTP_PASS: Joi.string().required(),
  EMAIL_FROM: Joi.string().email().required(),

  // Observability
  OTEL_SERVICE_NAME: Joi.string().default('nestjs-skeleton'),
  OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string().uri().optional(),

  // App
  APP_URL: Joi.string().uri().required(), // base URL (para emails con links)
  COMMIT_SHA: Joi.string().default('unknown'), // inyectado por CI

  // Toggles
  SEED_DEMO: Joi.boolean().default(false),
}).unknown(true);
```

## ConfigModule

```ts
// app.module.ts
ConfigModule.forRoot({
  isGlobal: true,
  cache: true,
  validationSchema: envSchema,
  validationOptions: { abortEarly: false },
  load: [appConfig, jwtConfig, cookieConfig, oauthConfig],
});
```

`abortEarly: false` para reportar todos los errores de config al boot, no uno por uno.

## ConfigService access

Encapsular acceso a config en namespaces:

```ts
// config/jwt.config.ts
export default registerAs('jwt', () => ({
  privateKey: process.env.JWT_PRIVATE_KEY,
  publicKey: process.env.JWT_PUBLIC_KEY,
  accessTtlSec: Number(process.env.JWT_ACCESS_TTL_SEC),
  refreshTtlSec: Number(process.env.JWT_REFRESH_TTL_SEC),
}));

// uso
constructor(@Inject(jwtConfig.KEY) private readonly cfg: ConfigType<typeof jwtConfig>) {}
```

## .env.example

Versionado en repo. Lista **todas** las variables con valores dummy. CI verifica que `.env.example` cubre todas las del schema (script lint).

```
# .env.example
NODE_ENV=dev
DATABASE_URL=postgresql://user:pass@localhost:5432/db
REDIS_URL=redis://localhost:6379
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
# ...
```

## Secrets management

| Ambiente         | Storage                                                                            | Notas                    |
| ---------------- | ---------------------------------------------------------------------------------- | ------------------------ |
| **Local dev**    | `.env` (git-ignored)                                                               | Cada dev tiene el suyo   |
| **CI**           | GitHub Actions secrets                                                             | Inyectados como env vars |
| **Staging/Prod** | Cloud secrets manager (AWS Secrets Manager / GCP Secret Manager / Doppler / Vault) | Pulled at boot           |

### Pulling secrets at boot

```ts
// main.ts (antes de NestFactory)
import { fetchSecretsFromVault } from './shared/infrastructure/secrets';

await fetchSecretsFromVault(); // populates process.env from external store
```

Adapter pattern: `ISecretProvider` con implementaciones para cada cloud. Default `EnvVarSecretProvider` (no-op, useful para dev).

## Rotación

- **JWT keys**: rotables. Public key set acepta lista de claves activas (`kid` claim). Soft rotation: emite con nueva, valida con cualquiera de las activas durante ventana.
- **Cookie secret**: rotable (lista de keys). `cookie-parser` con array de secrets.
- **DB password**: rotación con downtime mínimo via secrets manager + connection retry en app.
- **OAuth secrets**: rotables, pero requieren update en provider's console.

Ningún secreto debería tener TTL infinito en docs internas — todos con plan de rotación.

## .env loading order

1. Variables del proceso (`process.env`).
2. `.env.${NODE_ENV}.local` (git-ignored).
3. `.env.${NODE_ENV}` (git-ignored).
4. `.env.local` (git-ignored).
5. `.env` (git-ignored).
6. `.env.example` solo como docs, **no** se carga.

NestJS ConfigModule respeta este orden por default.

## Logs prohibidos

- Imprimir `JWT_PRIVATE_KEY`, `COOKIE_SECRET`, `*_CLIENT_SECRET`, `SMTP_PASS` está prohibido.
- pino redact (ver `cross-cutting/logging.md`) cubre los paths comunes; configurar adicional para envvars.

## Audit

Quarterly:

- Confirmar que ningún secret está en repo (rotación + `git secret-scan`).
- Verificar que rotaciones programadas se ejecutaron.
- Revisar accesos al secret store.
