# ADR-004 — JWT delivery: access en body + refresh en cookie HttpOnly

**Status**: Accepted (Mayo 2026)

## Context

Hay tres formas comunes de entregar tokens JWT al cliente:

1. **Ambos en cookies** (`Authorization` no se usa): cero exposición a JS, requiere CORS con credentials y CSRF protection.
2. **Ambos en body / `Authorization: Bearer`**: cliente guarda en localStorage o memoria — riesgo XSS si va a localStorage.
3. **Híbrido**: access token corto en body (cliente lo tiene en memoria, no localStorage), refresh largo en cookie HttpOnly.

Trade-offs:

| Aspecto                | Cookies puras                    | Bearer puro             | Híbrido                                      |
| ---------------------- | -------------------------------- | ----------------------- | -------------------------------------------- |
| Riesgo XSS leak access | Bajo                             | Alto si localStorage    | Medio (en memoria)                           |
| Riesgo CSRF            | Alto, requiere SameSite + tokens | Cero (no se envía auto) | Solo en endpoint refresh                     |
| Compatibilidad mobile  | Mala                             | Buena                   | Buena (cliente decide qué hacer con refresh) |
| Logout server-side     | Trivial                          | Requiere blocklist      | Trivial vía cookie clear                     |

## Decision

**Híbrido**:

- **Access token**: JWT corto (15 min). Devuelto en el body de `POST /auth/login`. Cliente lo guarda en memoria (no localStorage, no sessionStorage).
- **Refresh token**: opaque token (UUID v4 + entropy 256-bit), almacenado en DB. Devuelto en cookie con flags:
  - `HttpOnly` — no accesible por JS.
  - `Secure` — solo HTTPS.
  - `SameSite=Strict` — cero envío cross-site.
  - `Path=/auth` — solo se envía a endpoints de auth (refresh, logout).
  - `Max-Age=2592000` — 30 días.

- **Refresh rotation**: cada uso emite par nuevo y revoca el viejo. Familia de tokens encadenada (parentId).
- **Theft detection**: si un refresh ya revocado se reusa, revocar la familia entera + invalidar todas las sesiones del user.

- **CSRF**: `SameSite=Strict` cubre el caso común. Para endpoints que aceptan request POST con cookie y body (raros, solo `/auth/refresh` y `/auth/logout`), validar origin header como defensa extra.

- **Mobile / SPAs cross-origin**: si un cliente mobile no puede usar cookies, expone modo opcional `Authorization: Bearer <refresh>` solo para el endpoint `/auth/refresh`. El access sigue siendo bearer en `Authorization`.

## Consequences

**Positivas**:

- XSS no roba refresh (HttpOnly).
- CSRF mitigado por SameSite.
- Logout server-side con un `clearCookie + DELETE FROM refresh_tokens`.
- Rotation + theft detection cumple OWASP recommendations para session management.

**Negativas / mitigaciones**:

- **Web + mobile dual UX**: dos flujos de delivery. Mitigación: documentar ambos en Swagger; default web con cookies.
- **CORS con `credentials: include`**: requiere `Access-Control-Allow-Origin` específico (no `*`). Mitigación: lista blanca en `ConfigModule`.
- **Tamaño de DB**: tabla de refresh tokens crece con sesiones activas. Mitigación: soft-delete + cleanup job nocturno de expirados.
- **Multi-tab UX**: si una pestaña hace refresh, las otras pierden el access. Mitigación: BroadcastChannel para sincronizar (responsabilidad del frontend; doc del skeleton lo nota).

## Referencias

- OWASP Session Management Cheat Sheet.
- Auth0 — Refresh Token Rotation.
- IETF draft-ietf-oauth-security-topics (refresh token rotation).
