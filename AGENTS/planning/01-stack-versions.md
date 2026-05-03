# 01 — Stack & versiones (LTS — Mayo 2026)

Esta es la matriz vinculante. Cuando una versión se actualice, se edita aquí y se referencia en CI.

## Runtime y framework

| Capa        | Tecnología | Versión target       | Soporte hasta | Notas                                                             |
| ----------- | ---------- | -------------------- | ------------- | ----------------------------------------------------------------- |
| Runtime     | Node.js    | **24 LTS** (Krypton) | Apr 2028      | `engines.node` en `package.json` debe pinnear `>=24.0.0 <25`      |
| Package mgr | pnpm       | 9.x                  | —             | `packageManager` en `package.json` para activar Corepack          |
| Framework   | NestJS     | **11.1.x**           | —             | v12 en roadmap Q3 2026 (ESM-first); upgrade tras un release point |
| Lenguaje    | TypeScript | 5.5+                 | —             | `strict: true`, `noUncheckedIndexedAccess: true`                  |

## Datos

| Capa  | Tecnología | Versión target | Notas                                                        |
| ----- | ---------- | -------------- | ------------------------------------------------------------ |
| DB    | PostgreSQL | **17.x**       | 5y soporte estándar Postgres                                 |
| ORM   | Prisma     | **7.5+**       | Soporta savepoints y nested transactions con rollback        |
| Cache | Redis      | 7.x            | Para Throttler, ability cache, refresh token revocation list |

> **Prisma 7 + NestJS gotcha**: Prisma 7 ships ESM por defecto. Hay que setear `moduleFormat = "cjs"` en `generator client` para compatibilidad con NestJS hasta v11.

## Auth & seguridad

| Capa          | Paquete                                 | Versión | Notas                                                 |
| ------------- | --------------------------------------- | ------- | ----------------------------------------------------- |
| Hashing       | `argon2`                                | latest  | argon2id; OWASP 2026: m=65536, t=3, p=1               |
| JWT           | `@nestjs/jwt` + `passport-jwt`          | latest  | RS256 (claves rotables)                               |
| Passport core | `@nestjs/passport` + `passport`         | latest  | Strategy DI                                           |
| OAuth Google  | `passport-google-oauth20`               | latest  | Scope `email profile`                                 |
| OAuth GitHub  | `passport-github2`                      | latest  | Scope `user:email`                                    |
| Authorization | `@casl/ability` + `@casl/prisma`        | latest  | RBAC + ABAC + filtrado a nivel query                  |
| Rate limiting | `@nestjs/throttler`                     | latest  | Storage Redis vía `@nest-lab/throttler-storage-redis` |
| Headers       | `helmet`                                | latest  | CSP, HSTS, X-Frame-Options                            |
| Validation    | `class-validator` + `class-transformer` | latest  | Global ValidationPipe                                 |
| Cookies       | `cookie-parser`                         | latest  | Parse refresh cookie                                  |

## Observabilidad

| Capa            | Paquete                        | Versión | Notas                                   |
| --------------- | ------------------------------ | ------- | --------------------------------------- |
| Logger          | `nestjs-pino`                  | latest  | Logger oficial; reemplaza Logger nativo |
| Pino transport  | `pino-opentelemetry-transport` | latest  | Output OTel Log Data Model              |
| Tracing/metrics | `@opentelemetry/sdk-node`      | latest  | Init **antes** de `NestFactory.create`  |
| Nest OTel       | `nestjs-otel`                  | latest  | Decoradores `@Span`, métricas           |
| Health checks   | `@nestjs/terminus`             | latest  | DB + Redis + memoria                    |

## Testing

| Capa        | Paquete                                                | Versión | Notas                               |
| ----------- | ------------------------------------------------------ | ------- | ----------------------------------- |
| Test runner | Jest                                                   | 29.x    | + `ts-jest`                         |
| HTTP        | `supertest`                                            | 7.x     | E2E                                 |
| Containers  | `@testcontainers/postgresql` + `@testcontainers/redis` | latest  | Spin-up en `beforeAll`              |
| Faker       | `@faker-js/faker`                                      | latest  | Object Mother factories             |
| Coverage    | Jest builtin                                           | —       | Umbrales en `04-coverage-policy.md` |

## Tooling

| Capa      | Paquete                          | Versión | Notas                              |
| --------- | -------------------------------- | ------- | ---------------------------------- |
| Lint      | ESLint 9 + `@typescript-eslint`  | latest  | Flat config                        |
| Format    | Prettier                         | 3.x     | + `eslint-config-prettier`         |
| Commit    | Husky + lint-staged + Commitlint | latest  | Conventional Commits               |
| API docs  | `@nestjs/swagger`                | 11+     | OpenAPI 3.1, served at `/api/docs` |
| Container | Docker (multi-stage)             | —       | Base `node:24-alpine`              |

## Proveedores externos (opcionales)

- **Email**: `nodemailer` para dev, Resend/SES para prod.
- **Object storage**: S3-compatible (MinIO en dev).
- **Secrets**: Doppler / AWS Secrets Manager / HashiCorp Vault — el skeleton solo provee `ConfigModule + Joi` y leve abstracción `SecretProvider`.

## Política de actualizaciones

- Los pinnings mayores (Node, NestJS, Prisma, Postgres) se revisan **trimestralmente** y solo bajan a este doc tras pasar matriz de tests.
- Los minor/patch se actualizan vía Renovate/Dependabot con auto-merge si CI verde.
- Una breaking-change requiere ADR superseding al anterior.
