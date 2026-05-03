# Cross-cutting — Validation

## Tres niveles de validación

| Nivel                    | Dónde                           | Herramienta                                                       | Qué valida                                                              |
| ------------------------ | ------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1. **Wire format**       | DTO en presentation             | `class-validator` + `class-transformer` + `ValidationPipe` global | Tipos primitivos, longitudes, formato (email, UUID), enum membership    |
| 2. **Domain invariants** | Value Objects + factory methods | TypeScript + `Result`                                             | Reglas del dominio: email parseable, password fuerte, fechas coherentes |
| 3. **Business rules**    | Use cases / domain services     | Specifications + queries                                          | Email único, usuario activo, etc. (requieren state)                     |

Los tres niveles son obligatorios. Una validación en DTO **no** reemplaza la validación en VO — el DTO se brinca si el call viene de un test, una queue o un CLI.

## ValidationPipe global

```ts
// main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true, // strip campos no decorados
    forbidNonWhitelisted: true, // 400 si vienen extra
    transform: true, // convierte plain → instancia DTO
    transformOptions: { enableImplicitConversion: true },
    stopAtFirstError: false, // reporta todos los errores juntos
  }),
);
```

## DTO conventions

```ts
export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
```

- Una clase DTO **por endpoint** (no compartir entre create/update).
- Decorators de Swagger (`@ApiProperty`) requeridos para documentación.
- Para query params usar `class-transformer` con `@Type(() => Number)` etc.

## VO validation

```ts
export class Email extends ValueObject<{ value: string }> {
  static create(raw: string): Result<Email, InvalidEmail> {
    if (typeof raw !== 'string' || raw.length > 254) return Result.err(new InvalidEmail(raw));
    if (!EMAIL_REGEX.test(raw)) return Result.err(new InvalidEmail(raw));
    return Result.ok(new Email({ value: raw.toLowerCase().trim() }));
  }
}
```

- `Result.err` en lugar de throw — el caller decide.
- Normalización (lowercase, trim) ocurre en la creación del VO.

## Sanitización vs validación

- **Validar**: rechazar input que no cumple. Se hace en DTO + VO.
- **Sanitizar**: limpiar input (escape HTML, strip control chars). Se hace **al persistir** o **al renderizar**, no en validación.

Para el skeleton: el body de un `User.bio` puede contener HTML; se persiste tal cual; al renderizarlo en email/web se escapa con la lib de templates (sin sanitizar globalmente — preserva la intención del user).

## Contra payload bombs

- `bodyParser` con `limit: '100kb'` por default. Endpoints específicos (upload) suben límite.
- `forbidNonWhitelisted` evita enviar campos extra que un atacante usa para mass assignment.
- Para arrays: `@ArrayMaxSize(100)` siempre.

## Error response shape

Cuando ValidationPipe falla:

```json
{
  "statusCode": 400,
  "error": "Validation Failed",
  "message": [
    { "field": "email", "constraints": ["isEmail: email must be a valid email"] },
    { "field": "password", "constraints": ["minLength: password must be longer than 8 characters"] }
  ],
  "path": "/api/auth/register",
  "timestamp": "..."
}
```

Custom `exceptionFactory` en `ValidationPipe` para producir esta forma estable.

## Schemas vs decorators

`class-validator` está validado para el skeleton. Si un día la rigidez de decorators duele (ej. validación condicional compleja), evaluar `zod` o `valibot` con `nestjs-zod` adapter. Decisión deferida.
