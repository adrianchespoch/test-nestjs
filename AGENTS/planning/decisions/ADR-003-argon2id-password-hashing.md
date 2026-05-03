# ADR-003 — argon2id para hashing de passwords

**Status**: Accepted (Mayo 2026)

## Context

Cualquier sistema de auth con password local necesita un algoritmo de hashing one-way, lento y memory-hard. Las opciones vigentes en 2026:

| Algoritmo                   | Estado                                           | Recomendación OWASP 2026    |
| --------------------------- | ------------------------------------------------ | --------------------------- |
| MD5 / SHA-1 / SHA-256 plain | **Inseguros**                                    | Nunca                       |
| PBKDF2                      | Aceptable solo para FIPS                         | Solo si compliance lo exige |
| bcrypt                      | Seguro pero limitado a 72 bytes y no memory-hard | Aceptable para legacy       |
| scrypt                      | Seguro, memory-hard                              | Aceptable                   |
| **argon2id**                | Ganador del Password Hashing Competition (2015)  | **Recomendado primario**    |

OWASP Password Storage Cheat Sheet (rev. 2026) recomienda **argon2id** con parámetros mínimos `m=19MiB, t=2, p=1` y preferencia por `m=64MiB, t=3, p=1`.

## Decision

Usamos **argon2id** vía el paquete `argon2` (npm) con parámetros:

```ts
{
  type: argon2.argon2id,
  memoryCost: 65536,   // 64 MiB
  timeCost: 3,         // 3 iteraciones
  parallelism: 1,      // 1 hilo
}
```

`bcrypt` queda solo para verificación de hashes legacy importados de sistemas viejos, con re-hash a argon2id en el siguiente login exitoso.

## Consequences

**Positivas**:

- Resistente a ataques GPU/ASIC (memory-hard).
- Combina argon2i (resistente a side-channel) y argon2d (resistente a GPU).
- Soporta passwords de cualquier longitud (sin truncado a 72 bytes como bcrypt).
- Permite incrementar parámetros sin invalidar hashes viejos (cada hash lleva sus propios params).

**Negativas / mitigaciones**:

- **Costo en CPU/RAM al login**: ~80–150ms en hardware típico. Mitigación: el rate-limit en login lo absorbe. Si la API recibe 1000 req/s de login se reconsidera.
- **Costo en RAM**: 64 MiB por hash en flight. Mitigación: cap de concurrencia con `bottleneck` o pool si se necesita; en práctica el tráfico de login es muy bajo.
- **Native binding**: `argon2` compila nativo. Mitigación: imagen Docker con build deps en stage de build, runtime con solo `.node` binarios.
- **Migración desde bcrypt**: el `Password` VO debe detectar el prefijo (`$2b$` vs `$argon2id$`) y re-hashear silenciosamente al verificar.

## Referencia

- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- RFC 9106 — Argon2 Memory-Hard Function.
