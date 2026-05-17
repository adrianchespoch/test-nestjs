# memory.md — punto de partida por sesión

> Lee **solo este archivo** para arrancar. Si necesitás el porqué de una decisión
> de diseño, ahí sí vas a los `AGENTS/*` específicos. Última actualización: **2026-05-17**.

## Estado actual (TL;DR)

**El skeleton bootea de punta a punta.** `docker compose up -d` levanta los 4
servicios sanos y la API responde:

```
skeleton-api / postgres / redis / mailpit   →  all healthy, api restarts=0
GET /api/v1/health/live    200  {"status":"ok"}
GET /api/v1/health/ready   200  database:up redis:up
GET /api/docs              200  (Swagger)
Tests unit: 109/109 verde (18 suites)
```

⚠️ **Ojo con las rutas**: hay URI versioning con default `1`. La ruta real es
`/api/v1/...`, NO `/api/...`. Health = `/api/v1/health/{live,ready}`.

## Qué estaba roto y se arregló (2026-05-17)

El skeleton estaba scaffoldeado pero **nunca se había booteado**. Cascada de bugs
(cada fix destapaba el siguiente). Todos resueltos:

1. **Prisma CLI podado** — `prisma`+`dotenv` estaban en `devDependencies`;
   `pnpm prune --prod` los borraba de la imagen → `migrate deploy` al boot moría
   en loop. → Movidos a `dependencies`; `prisma.config.ts` ahora se copia al
   stage runtime del Dockerfile.
2. **Invocación del bin** — `CMD` hacía `node ./node_modules/.bin/prisma`; el
   shim de pnpm es shell, no JS. → `CMD` ejecuta el bin directo (sin `node`).
3. **Prisma 7 driver adapter** — Prisma 7 quitó `datasources`/`datasourceUrl`;
   el cliente exige un driver adapter. → Añadido `@prisma/adapter-pg`;
   `PrismaService` usa `new PrismaPg({ connectionString: DATABASE_URL })`.
4. **SMTP requerido** — compose no pasaba `SMTP_*`/`EMAIL_FROM` (Joi los exige).
   → Añadidos al compose + servicio **`mailpit`** (mail catcher dev, UI :8025).
5. **OAuth incondicional** — Google/GitHub strategies se registraban siempre y
   `passport-oauth2` lanza sin `clientID`. → Providers condicionales en
   `auth.module.ts`: solo se instancian si hay credenciales.
6. **Bug de orden JWT** — `JwtStrategy` lee la clave en su constructor pero
   `JwtSigner` la resolvía en `onModuleInit` (corre después de los constructores).
   → Resolución de claves movida al **constructor** de `JwtSigner`.
7. **NODE_ENV** — compose forzaba `production` (exige keypair real) para un stack
   `http://localhost`. → `NODE_ENV=${NODE_ENV:-dev}` → keypair RS256 efímero.
8. **pino-pretty podado** — en `dev` el logger usa `pino-pretty` (era devDep).
   → Movido a `dependencies`.
9. **Healthcheck 404** — Docker/compose pegaban a `/api/health/live` sin `/v1`.
   → Corregido a `/api/v1/health/live` en `Dockerfile` y `docker-compose.yml`.

**Archivos tocados (boot fix)**: `package.json`, `pnpm-lock.yaml`, `Dockerfile`,
`docker-compose.yml`, `src/shared/infrastructure/prisma/prisma.service.ts`,
`src/modules/auth/auth.module.ts`,
`src/modules/auth/infrastructure/crypto/jwt-signer.ts`.

### Swagger RBAC enriquecido (2026-05-17)

`RolesController` tenía `@ApiOkResponse()` vacíos y los use cases devuelven
interfaces TS (se borran en runtime → Swagger sin schema/ejemplos). Fix:
- DTOs de respuesta tipados con `@ApiProperty`+`example`:
  `src/modules/rbac/presentation/dtos/{role-response,permission-response}.dto.ts`.
- `ApiErrorDto` reutilizable en `src/shared/presentation/dtos/api-error.dto.ts`
  (refleja el shape de `GlobalExceptionFilter`).
- `roles.controller.ts` cableado: respuestas tipadas, `@ApiParam`/`@ApiBody`,
  errores 401/403/404 con `ApiErrorDto`.
### Swagger auth/admin/oauth a la par (2026-05-17)

Mismo tratamiento aplicado a `auth`, `admin` y `oauth`:
- Nuevo `src/modules/auth/presentation/dtos/auth-responses.dto.ts`:
  `EmailVerifiedResponseDto`, `AcceptedResponseDto`, `PasswordUpdatedResponseDto`,
  `OAuthCallbackResponseDto`.
- `example` añadidos a `login/register/password-reset` DTOs (passwords, tokens).
- Controllers: errores 400/401/403/404/409 tipados con `ApiErrorDto`, 204 con
  `@ApiNoContentResponse`, 202 con `@ApiAcceptedResponse`, `@ApiParam`/`@ApiQuery`
  con ejemplos, redirect 302 documentado en `/auth/:provider`.
- Verificado en `/api/docs-json`: 15 schemas, todas las rutas con response shape.
  Tests 109/109, lint/typecheck limpios, contenedor healthy.

Swagger ahora **completo** en todos los módulos (RBAC + Auth + Admin + OAuth).

## Cómo correrlo

```sh
docker compose up -d            # stack completo (dev, keypair efímero)
docker compose down -v          # baja + borra volúmenes
# App: http://localhost:3000/api/v1   ·   Swagger: /api/docs
# Mailpit UI: http://localhost:8025
```

Para **producción**: `NODE_ENV=production` + `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY`
reales (sin ellos `JwtSigner` aborta a propósito).

## Guía de Frontend (2026-05-17)

`__docs__/guides/00_front/00_skeleton_front_guide.md` — directrices de core,
flujos (registro/verify/login, reset, OAuth, sesión), arquitectura de rutas y
pantallas mínimas para quien arme el front. Mantener sincronizada con esta
memoria y con Swagger.

Hallazgos al validar el happy path (relevantes para back y front):

- **Registro OK** (201 `{userId}`). **Login exige email verificado** → 403
  `EMAIL_NOT_VERIFIED`. Anti-enumeration confirmado (202 fijo en resend/reset).
- **Mailer = `ConsoleMailer` no-op**: NO envía SMTP, solo loguea. Mailpit
  levantado pero **el backend no lo usa** (`EMAIL_SENDER` → `ConsoleMailer`).
  → verify/reset no completables E2E sin un adapter SMTP. Token sale por logs.
- **Bug cookie refresh**: se setea `Path=/api/auth` (hardcoded en
  `auth.controller.ts`/`oauth.controller.ts`) pero las rutas son
  `/api/v1/auth/...` → el browser nunca reenvía la cookie al refresh. El
  refresh por cookie está roto hasta corregir el path (a `/api/v1/auth` o
  excluir versioning en auth, o `/api`).
- **No existe `GET /api/v1/me`** (perfil + roles/permisos) → el front no puede
  gatear UI por permiso; hoy detecta permiso por 200/403.
- **`logout-all`** hoy solo limpia la cookie del browser actual (revocación
  global real pendiente — ver comentario en `auth.controller.ts`).
- **OAuth callback devuelve JSON** (no redirige al front con el token) —
  coordinar si se quiere redirect a `/oauth/callback`.

## Pendientes / deuda conocida

- **Doc drift** (no actualizado aún): `AGENTS/database/01-prisma-setup.md` muestra
  `datasource db { url = env(...) }` y `datasources: { db: { url } }` —
  patrones pre-Prisma-7 ya inválidos. `CLAUDE.md` no menciona el driver adapter.
  `README.md` puede documentar health sin `/v1`.
- **Sin tests de boot**: bugs #5 y #6 son de la app, no de Docker. Los `test/e2e`
  y `test/integration` siguen TBD — un smoke que arranque `AppModule` los cazaría
  en CI.
- Cache de abilities RBAC en Redis con pub/sub: deferred (sin cache hoy).
