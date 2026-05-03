# Cross-cutting — Error handling

## Filosofía

Los errores del **dominio** son valores (`Result.Err`). Los errores de **infraestructura** son excepciones (DB caída, timeout, OOM). Los errores de **request** son `HttpException` de Nest (404, 400, 401, 403).

Cada uno se maneja distinto:

- Dominio → use case retorna `Result.Err`, controller lo mapea a HTTP status apropiado.
- Infra → propaga como excepción → filter global la convierte en 500 (sin leak de detalle).
- HTTP → tirar `NotFoundException`, `BadRequestException` directamente cuando aplique.

## Mapping Domain → HTTP

```ts
function mapDomainError(err: DomainError): HttpException {
  switch (err.code) {
    case 'EMAIL_ALREADY_EXISTS':
      return new ConflictException('Email already exists');
    case 'INVALID_CREDENTIALS':
      return new UnauthorizedException('Invalid credentials');
    case 'ACCOUNT_LOCKED':
      return new ForbiddenException({ code: err.code, retryAfter: err.retryAfter });
    case 'EMAIL_NOT_VERIFIED':
      return new ForbiddenException({ code: err.code });
    case 'TOKEN_EXPIRED':
      return new UnauthorizedException({ code: err.code });
    case 'TOKEN_REUSE_DETECTED':
      return new UnauthorizedException({ code: 'INVALID_TOKEN' }); // no leak
    default:
      return new InternalServerErrorException();
  }
}
```

**Regla anti-leak**: `TOKEN_REUSE_DETECTED` se mapea a un código genérico para no informar al atacante de la detección. Solo log lleva el detalle real.

## Global exception filter

```ts
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return res.status(status).json(formatHttpError(exception, req));
    }

    if (isPrismaKnownError(exception)) {
      return res.status(409).json(formatPrismaError(exception, req));
    }

    // Unknown — log con stack, responde 500 sin detalle
    logger.error({ err: exception, requestId: req.id }, 'Unhandled exception');
    return res.status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Unexpected error',
      requestId: req.id,
      timestamp: new Date().toISOString(),
    });
  }
}
```

## Prisma error mapping

| Prisma code                 | HTTP | Razón                                                                          |
| --------------------------- | ---- | ------------------------------------------------------------------------------ |
| `P2002` (unique constraint) | 409  | Duplicate key                                                                  |
| `P2025` (record not found)  | 404  | Para updates/deletes — para reads, el repo retorna `null` y el use case decide |
| `P2003` (foreign key)       | 409  | FK violation                                                                   |
| `P1001` (DB unreachable)    | 503  | No leak de motor                                                               |
| Otros                       | 500  | Sin detalle                                                                    |

## Result type usage

```ts
export type Result<T, E = Error> = Ok<T> | Err<E>;

export const Result = {
  ok: <T>(value: T): Ok<T> => ({ kind: 'ok', value, isOk: () => true, isErr: () => false }),
  err: <E>(error: E): Err<E> => ({ kind: 'err', error, isOk: () => false, isErr: () => true }),
};
```

Use cases siempre devuelven `Promise<Result<TSuccess, TError>>`. **Nunca** throw para errores de negocio.

## Logging de errores

- **Dominio (Result.Err)**: log a nivel `info` con código y contexto (no es un bug, es flujo esperado).
- **Infra inesperada**: log a nivel `error` con stack completo y `requestId`.
- **Validación request**: log a nivel `warn` (mucho ruido en prod, opcional reducir a `debug`).

PII never en logs (ver [`logging.md`](./logging.md)).

## 4xx vs 5xx

- **4xx** = culpa del cliente. No debería disparar alertas.
- **5xx** = culpa nuestra. SLO/alerting basado en `5xx_rate`.

`ForbiddenException` con código `ACCOUNT_LOCKED` no es 5xx — es estado esperado. Si está alerteando, refinar el SLO.

## Reintentos

- **Idempotent operations** (GET, DELETE, PUT con clave idempotente): cliente puede reintentar.
- **POST** (crear): no idempotent salvo que se acepte `Idempotency-Key` header (no incluido en v1).

## ¿Cuándo throw vs Result?

- **Throw** si la condición es un programmer error (assertion violada, contrato roto).
- **Throw** si es infra failure (DB connection lost).
- **Result.err** si es estado del dominio (email duplicado, password incorrecto, cuenta bloqueada).

Heurística: si quieres que aparezca en monitoring como error, throw. Si es flujo de negocio normal, Result.
