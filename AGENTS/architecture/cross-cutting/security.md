# Cross-cutting — Security

Stack defensivo del skeleton. Cada item mapea a un control OWASP top 10 (2023+).

## Headers (helmet)

```ts
// main.ts
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // si necesario para Swagger UI
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    crossOriginEmbedderPolicy: false, // habilitar si no estás detrás de proxy con coep
  }),
);
```

Cobertura: A05 Security Misconfiguration, A03 Injection (XSS), clickjacking.

## CORS

```ts
app.enableCors({
  origin: configService.get('CORS_ORIGINS').split(','), // lista blanca, no wildcard
  credentials: true, // cookies cross-origin
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id'],
});
```

Wildcard `*` está prohibido — explosivo en combinación con `credentials: true` (no funciona, pero el patrón en sí es inseguro).

## Rate limiting (Throttler)

```ts
ThrottlerModule.forRootAsync({
  imports: [ConfigModule, RedisModule],
  inject: [ConfigService, REDIS_CLIENT],
  useFactory: (config, redis) => ({
    storage: new ThrottlerStorageRedisService(redis),
    throttlers: [
      { name: 'short', ttl: 1000, limit: 10 }, // 10 req/s
      { name: 'medium', ttl: 60_000, limit: 100 }, // 100 req/min
      { name: 'long', ttl: 3_600_000, limit: 1000 }, // 1000 req/h
    ],
  }),
});
```

Endpoints sensibles con override:

```ts
@Throttle({ login: { ttl: 600_000, limit: 5 } })  // 5 logins / 10 min / IP
@Post('login')
```

Identificadores: por IP por default, override por `userId` autenticado para endpoints post-auth.

Cobertura: A07 Identification and Authentication Failures, brute force.

## Authentication

Ver [`ADR-004`](../../planning/decisions/ADR-004-jwt-cookie-delivery.md). Resumen de medidas:

- Argon2id passwords (ADR-003).
- Account lockout exponencial tras N fallos.
- Refresh rotation + theft detection.
- Email enumeration mitigation: respuestas en tiempo constante para login/reset, idéntico mensaje para "user no existe" vs "password incorrecto".
- Email verification antes de habilitar login.

## Authorization

Ver [`ADR-005`](../../planning/decisions/ADR-005-casl-rbac-abac.md). Resumen:

- CASL para RBAC + ABAC.
- 403 nunca revela existencia (devolver 404 en su lugar cuando aplique).
- Listing endpoints filtran via `accessibleBy(ability)` — no fetch+filter.

Cobertura: A01 Broken Access Control.

## Input validation

Ver [`validation.md`](./validation.md).

Adicional contra inyección:

- Prisma usa parametrized queries siempre — no concatenar `$queryRaw` con input.
- Si necesitas raw SQL: `Prisma.sql\`SELECT ... WHERE x = ${value}\`` (template tagged seguro), nunca `prisma.$queryRawUnsafe`.

Cobertura: A03 Injection.

## Secrets

```ts
// config/env.schema.ts (Joi)
export const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('dev', 'test', 'prod').required(),
  DATABASE_URL: Joi.string().uri().required(),
  REDIS_URL: Joi.string().uri().required(),
  JWT_PRIVATE_KEY: Joi.string().required(), // RS256 PEM
  JWT_PUBLIC_KEY: Joi.string().required(),
  COOKIE_SECRET: Joi.string().min(32).required(),
  GOOGLE_CLIENT_ID: Joi.string().required(),
  GOOGLE_CLIENT_SECRET: Joi.string().required(),
  GITHUB_CLIENT_ID: Joi.string().required(),
  GITHUB_CLIENT_SECRET: Joi.string().required(),
  CORS_ORIGINS: Joi.string().required(),
  OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string().uri(),
});
```

App falla al boot si falta algo. Sin defaults inseguros.

Secret store sugerido (en orden de preferencia): cloud secrets manager (AWS/GCP) → Doppler → Vault → `.env` con `git-secret`. Nunca commit de `.env`.

Cobertura: A05, A02 Cryptographic Failures.

## Crypto

- TLS 1.3 only (configuración de proxy, no de Nest).
- JWT con **RS256** (asimétrico) — la pública se distribuye, la privada solo en el signer. Permite verificación distribuida.
- Cookie secret rotable (multi-key). Soporta cookies emitidas por la versión anterior durante el rollout.
- Password reset / email verification tokens: random 32 bytes (`randomBytes(32).toString('base64url')`), hashed-stored, comparados con timing-safe compare.

## Logging seguro

Ver [`logging.md`](./logging.md). Campos redacted obligatorios.

## Dependencias

- `pnpm audit --prod` en CI — falla en `high` o superior.
- Snyk / Trivy / Socket integrados en GitHub Actions.
- Renovate/Dependabot con auto-merge para patch updates verde en CI.

Cobertura: A06 Vulnerable and Outdated Components.

## CSRF

`SameSite=Strict` en refresh cookie cubre la mayoría. Endpoints que aceptan cookie + body POST (solo `/auth/refresh` y `/auth/logout`) validan `Origin` header contra lista blanca como defensa en profundidad.

Cobertura: A01.

## SSRF

Si el skeleton hace fetches outbound (avatares OAuth, webhooks): lista blanca de dominios + bloqueo de rangos privados (`127.0.0.0/8`, `10.0.0.0/8`, etc.). Ver `axios` con custom resolver.

Cobertura: A10 SSRF.

## Mass assignment

`forbidNonWhitelisted: true` en ValidationPipe + `@Expose()` explícito en `class-transformer` evita campos sneak. Endpoints de update **no** aceptan `id`, `createdAt`, `roles` salvo en endpoints específicos protegidos.

## Object-level authorization (IDOR)

Cada acción sobre un recurso pasa por CASL `ability.can(action, resource)` con la instancia, no solo con el subject. Ej:

```ts
const post = await posts.findById(id);
if (!ability.can('update', post)) throw new ForbiddenException();
```

NO basta con `ability.can('update', 'Post')` — eso es solo a nivel clase.

## Audit log

Eventos de negocio críticos (login, logout, password reset, role assigned, permission granted) se loggean a `info` con `event` field y se envían a un sink dedicado (ELK index `audit-*` con retención 1y).

## Penetration testing

Pre-deploy a prod: correr ZAP baseline scan en CI contra ambiente staging. Escalar a pen-test profesional cuando la app maneje datos sensibles (PII, financial).
