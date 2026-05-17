# Guía de Frontend — Skeleton NestJS (estado actual)

> **Quién escribe**: el dev del backend. **Para**: quien arme el front.
> **Objetivo**: que sepas qué se puede hacer HOY, qué pantallas necesitás por
> flujo, cómo es la arquitectura de rutas y los contratos de auth. No hay
> mockups acá — hay estructura, contratos y directrices. El detalle de
> request/response exacto está en **Swagger: `http://localhost:3000/api/docs`**
> (OpenAPI JSON en `/api/docs-json`).
>
> Fecha: **2026-05-17**. Si algo del backend cambió, revisá `AGENTS/memory.md`.

---

## 0. Contrato base (leer sí o sí)

| Cosa | Valor | Implicancia para el front |
|------|-------|---------------------------|
| Base URL | `http://localhost:3000` | configurable por env del front |
| Prefijo + versión | **`/api/v1`** en TODO endpoint | `GET /api/v1/...`. NO existe `/api/...` sin `/v1` |
| Swagger UI | `/api/docs` | fuente de verdad del shape exacto |
| Access token | **JWT RS256**, lo devuelve el body del login/refresh | guardar **en memoria** (no localStorage), mandar en `Authorization: Bearer <token>` |
| Refresh token | cookie `refresh` **HttpOnly, signed** | el front NO la lee ni la maneja; el browser la manda solo |
| TTL access | 900 s (15 min) | refrescar antes de que expire |
| TTL refresh | 30 días | sesión "recordada" 30 días |
| CORS | `credentials: true`, orígenes whitelisteados (`CORS_ORIGINS`) | el front debe hacer fetch con `credentials: 'include'` y correr en un origin permitido (default `http://localhost:3001` y `:5173`) |
| Error shape | siempre el mismo JSON (ver §7) | un solo handler de errores global |

### ⚠️ Gotchas del estado actual (¡importantísimo!)

1. **Emails NO se envían.** El mailer es un `ConsoleMailer` no-op: el token de
   verificación / reset se loguea en la consola del backend, no llega a ningún
   inbox (Mailpit está levantado pero el backend todavía no lo usa).
   → **Implicancia**: los flujos de "verificar email" y "reset password" NO se
   pueden completar de punta a punta desde el front todavía. Construí las
   pantallas igual (el contrato es estable), pero para QA el token hay que
   sacarlo de los logs del backend hasta que se implemente un adapter SMTP.
2. **OAuth Google/GitHub está inactivo** salvo que se configuren
   `GOOGLE_CLIENT_ID` / `GITHUB_CLIENT_ID`. Sin credenciales, esas rutas fallan.
   Las pantallas/botones se pueden armar; el flujo real depende de config.
3. **Bug conocido de cookie de refresh**: hoy la cookie se setea con
   `Path=/api/auth` pero las rutas son `/api/v1/auth/...`, así que el browser
   nunca la reenvía al endpoint de refresh. Hasta que el backend lo corrija,
   **el refresh automático vía cookie no va a funcionar**. Diseñá el front
   para que el módulo de sesión sea aislado y fácil de ajustar cuando se fixee.
4. **JWT efímero en dev**: las claves se regeneran en cada restart del backend
   → todos los tokens se invalidan. En dev, tras reiniciar el back, hay que
   re-loguear. No es bug; es el modo dev.

---

## 1. Modelo de autenticación (cómo pensar la sesión)

- **Access token en memoria** (variable/estado, NO persistido). Se manda en
  `Authorization: Bearer`.
- **Refresh token = cookie HttpOnly** manejada por el browser. El front nunca
  la toca; solo hace requests con `credentials: 'include'`.
- **Estrategia de sesión sugerida**:
  1. Tras login → guardás `accessToken` + `accessTokenExpiresInSec` en memoria
     y un timer.
  2. Antes de expirar (o ante un `401`) → llamás `POST /api/v1/auth/refresh`.
     Devuelve nuevo access token (y rota la cookie).
  3. Si refresh falla (401) → sesión muerta → redirigir a `/login`.
- **Persistencia entre reloads**: como el access token vive en memoria, al
  recargar la página se pierde. El patrón correcto es: al bootear la app,
  intentar `POST /api/v1/auth/refresh` una vez; si responde 200 → sesión viva;
  si 401 → mostrar login. *(Esto depende del fix del gotcha #3.)*

---

## 2. Arquitectura de rutas del front

Dos zonas: **pública** (sin sesión) y **privada** (requiere access token). Una
tercera transversal: **callbacks/transición**.

```
PÚBLICAS (sin sesión; si ya hay sesión → redirigir a /app)
  /login                      → Pantalla Login
  /register                   → Pantalla Registro
  /verify-email               → Pantalla "esperando/confirmar verificación"
  /forgot-password            → Pantalla "pedir reset"
  /reset-password             → Pantalla "setear nueva password" (con ?token)
  /oauth/callback             → Pantalla transitoria (spinner) post-OAuth

PRIVADAS (requieren Bearer; route guard → si no hay sesión, redirigir a /login)
  /app                        → Home / dashboard
  /app/account                → Perfil / sesión actual / logout
  /app/admin/users            → Admin: buscar usuario, desbloquear  (perm: unlock:User)
  /app/admin/rbac/roles       → Admin: listar roles + permisos      (perm: read:Role)
  /app/admin/rbac/users/:id   → Admin: asignar/quitar roles a user  (perm: update:User)

GUARD DE RUTA
  - Privada sin access token → redirect /login (guardando returnUrl)
  - Privada con token pero 403 del back por permiso → pantalla "Sin permiso"
  - Pública con sesión activa → redirect /app
```

**Route guard de permisos (RBAC)**: el back NO expone hoy un endpoint
"mis permisos / mi perfil". El front sabe si tiene permiso sólo por la
respuesta del endpoint (200 vs 403). Directriz: no escondas features por
adivinar permisos en el front; mostralas y manejá el `403` con una pantalla/
toast "no autorizado". (Si se necesita gating fino en UI, pedir al backend un
endpoint `GET /api/v1/me` con roles/permisos — hoy no existe, ver §9.)

---

## 3. Flujo: Registro → Verificación → Login

```
[/register]  POST /api/v1/auth/register {email,name,password}
   201 {userId}  ─────────────►  [/verify-email]  "Te enviamos un correo…"
   400 validación → mostrar errores de campo (ver §7)
   409 email ya existe → "ese email ya está registrado" + link a /login

[/verify-email]  (estado: el usuario espera el correo)
   - El usuario abre el link del mail → cae en el front con ?token=...
   - El front llama  GET /api/v1/auth/email/verify?token=<token>
       200 {verified:true} → "Cuenta verificada" → CTA a /login
       400 token inválido/expirado → "Link inválido o vencido" + botón "reenviar"
   - Botón "reenviar correo":
       POST /api/v1/auth/email/verify/resend {email}
       202 {accepted:true}  (SIEMPRE 202, exista o no el email — anti-enumeration)
       → UX: "Si el email existe, te reenviamos el correo" (NO afirmar que existe)

[/login]  POST /api/v1/auth/login {email,password}
   200 LoginResponseDto {accessToken, accessTokenExpiresInSec, userId, sessionId}
       → guardar token en memoria, redirect /app
   401 credenciales inválidas → "Email o contraseña incorrectos"
   403 code=EMAIL_NOT_VERIFIED → redirigir/mostrar /verify-email con botón reenviar
   403 cuenta bloqueada (lockout) → "Cuenta bloqueada temporalmente, probá en X min"
   429 demasiados intentos → "Demasiados intentos, esperá unos minutos"
```

**Pantallas necesarias**: `RegisterForm`, `VerifyEmailPending` (mensaje +
acción reenviar), `VerifyEmailResult` (éxito/fallo del token — puede ser la
misma con estados), `LoginForm`.

**Estado actual**: como el mail no se envía (ConsoleMailer), `/verify-email`
debe existir igual pero en QA el token se obtiene de los logs del backend.
No bloquees el desarrollo del front por esto.

---

## 4. Flujo: Sesión activa (refresh, logout)

```
Request a recurso privado → Authorization: Bearer <accessToken>, credentials:'include'
   401 → intentar POST /api/v1/auth/refresh (credentials:'include')
            200 LoginResponseDto (sin userId) → reintentar request original 1 vez
            401 → sesión muerta → limpiar memoria → redirect /login

[/app/account]
  Logout:        POST /api/v1/auth/logout       → 204 (idempotente) → limpiar estado, /login
  Logout all:    POST /api/v1/auth/logout-all   → 204 (requiere Bearer) → idem
```

**Pantallas**: `AccountPage` con botones "Cerrar sesión" y "Cerrar sesión en
todos los dispositivos". Un **interceptor HTTP central** que implemente el
patrón refresh-on-401 (con lock para no disparar N refresh en paralelo).

> Recordá gotcha #3: el refresh por cookie hoy está roto por el path. El
> interceptor lo escribís igual; cuando el back fixee el path, funciona sin
> tocar el front.

---

## 5. Flujo: Password reset

```
[/forgot-password]  POST /api/v1/auth/password-reset/request {email}
   202 {accepted:true}  SIEMPRE (anti-enumeration)
   → UX: "Si el email existe, te enviamos instrucciones"

[/reset-password?token=...]  POST /api/v1/auth/password-reset/confirm {token,newPassword}
   200 {updated:true} → "Contraseña actualizada, todas las sesiones se cerraron" → /login
   400 token inválido/expirado o password débil → mostrar error puntual
```

**Pantallas**: `ForgotPasswordForm` (solo email), `ResetPasswordForm` (toma
`token` del query string + input nueva password). Token de reset: TTL 30 min,
single-use. Tras confirmar, **todas las sesiones se invalidan** → forzar login.

---

## 6. Flujo: OAuth Google / GitHub

OAuth es un **redirect dance**, NO un fetch. El front NO hace el POST; abre/
navega a la URL del backend y este redirige al provider.

```
[/login]  Botón "Continuar con Google"  → window.location = `${API}/api/v1/auth/google`
          Botón "Continuar con GitHub"   → window.location = `${API}/api/v1/auth/github`
   (opcional "link account": si el usuario ya está logueado, mandar el Bearer
    en esa navegación para que el back asocie el provider a su cuenta)

  Backend → 302 al provider → usuario consiente → provider redirige al
  callback del backend (/api/v1/auth/google/callback?...&state=...)

  El callback del backend responde 200 OAuthCallbackResponseDto:
     {accessToken, accessTokenExpiresInSec, userId, sessionId, created, linked}
     401 → state inválido / email faltante → volver a /login con error
```

**Pantalla transitoria `/oauth/callback`**: el backend hoy **devuelve JSON** en
el callback (no redirige al front con el token). Directriz para el front:
- Lo más limpio sería que el back redirija al front con el resultado; hoy no lo
  hace. Coordinar con backend si se quiere `redirect a /oauth/callback`.
- Mientras tanto: `created=true` → onboarding nuevo usuario; `linked=true` →
  "vinculaste Google/GitHub a tu cuenta"; ambos false → login normal.

**Pantallas**: botones OAuth en `LoginForm` y en `AccountPage` (para linkear),
`OAuthCallback` (spinner + manejo de resultado/errores).

---

## 7. Manejo de errores (un solo handler)

Todo error sale con este shape (`ApiErrorDto`):

```json
{
  "statusCode": 403,
  "code": "EMAIL_NOT_VERIFIED",
  "message": "Email is not verified",
  "path": "/api/v1/auth/login",
  "requestId": "uuid",
  "timestamp": "2026-05-17T18:07:33.211Z",
  "details": { "campo": "mensaje" }
}
```

Directrices:
- **Switch por `code`**, no por `message` (el message puede cambiar).
- `details` aparece en errores de validación (400) → mapear a errores de campo.
- Mostrar/loguear `requestId` en errores 500 (sirve para soporte).
- Tabla mínima de mapeo UX:

| HTTP | code típico | UX sugerida |
|------|-------------|-------------|
| 400 | `VALIDATION` / `INVALID_*` | errores inline por campo (usar `details`) |
| 401 | credenciales / token | "no autenticado" → intentar refresh / ir a login |
| 403 | `EMAIL_NOT_VERIFIED` | ir a /verify-email |
| 403 | `FORBIDDEN` (RBAC) | pantalla/toast "Sin permiso" |
| 403 | cuenta bloqueada | "Cuenta bloqueada, reintentá más tarde" |
| 404 | `NOT_FOUND` | "Recurso no existe" |
| 409 | conflicto | "Ya existe" (ej: email en registro) |
| 429 | rate limit | "Demasiados intentos, esperá" + deshabilitar submit |
| 500 | `INTERNAL_SERVER_ERROR` | "Error inesperado" + mostrar requestId |

---

## 8. Rate limiting (afecta la UX)

El backend limita por IP. El front debe **deshabilitar el submit** y mostrar
cooldown ante 429. Límites actuales:

| Endpoint | Límite |
|----------|--------|
| `POST /auth/login` | 5 / 10 min |
| `POST /auth/register` | 5 / hora |
| `POST /auth/refresh` | 30 / min |
| `POST /auth/email/verify/resend` | 1 / min |
| `POST /auth/password-reset/request` | 5 / 10 min |

Lockout de cuenta: 5 logins fallidos en 10 min → cuenta bloqueada 15 min
(distinto del rate limit por IP; el desbloqueo manual lo hace un admin).

---

## 9. Pantallas mínimas (checklist) + dependencias del backend

**Auth (público)**
- [ ] LoginForm (email/pass + botones OAuth + links a registro/forgot)
- [ ] RegisterForm
- [ ] VerifyEmailPending / VerifyEmailResult
- [ ] ForgotPasswordForm
- [ ] ResetPasswordForm
- [ ] OAuthCallback (transitoria)

**App (privado)**
- [ ] Layout privado + route guard (refresh-on-401)
- [ ] Home/Dashboard
- [ ] AccountPage (logout / logout-all / linkear OAuth)

**Admin (privado, gated por 403)**
- [ ] Admin Users: input userId → `POST /api/v1/admin/users/:userId/unlock` (204)
- [ ] RBAC Roles: `GET /api/v1/rbac/roles`, `GET /api/v1/rbac/permissions` (tablas)
- [ ] RBAC asignación: `POST /api/v1/rbac/users/:userId/roles {roleName}` (204),
      `DELETE /api/v1/rbac/users/:userId/roles/:roleName` (204)

**Dependencias/limitaciones del backend a tener presentes (estado 2026-05-17)**
1. Mailer no-op → verify/reset no completables E2E sin SMTP adapter.
2. Cookie de refresh con path roto → refresh automático no funciona aún.
3. OAuth requiere credenciales configuradas para funcionar.
4. No hay `GET /api/v1/me` (perfil + roles/permisos) → si el front necesita
   gating de UI por permiso, **pedirlo al backend**. Hoy: detectar permiso por
   200/403 del endpoint.
5. `logout-all` hoy solo limpia la cookie del browser actual (implementación
   completa pendiente en backend) — no asumir invalidación global real todavía.

> Cuando alguno de estos puntos cambie, debería reflejarse en `AGENTS/memory.md`
> y en esta guía. Si ves divergencia con Swagger, **Swagger manda** para shapes;
> esta guía manda para *flujo y directrices*.
