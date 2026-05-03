# Cross-cutting — Logging

> Decisión: ver [`ADR-006`](../../planning/decisions/ADR-006-pino-otel-observability.md).

## Setup

```ts
// app.module.ts
import { LoggerModule } from 'nestjs-pino';

LoggerModule.forRoot({
  pinoHttp: {
    transport:
      process.env.NODE_ENV === 'dev'
        ? { target: 'pino-pretty' }
        : { target: 'pino-opentelemetry-transport' },
    level: process.env.LOG_LEVEL ?? 'info',
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        'req.body.currentPassword',
        'req.body.newPassword',
        'res.headers["set-cookie"]',
        '*.creditCard',
        '*.ssn',
      ],
      censor: '[REDACTED]',
    },
    customProps: (req) => ({
      requestId: req.id,
      traceId: trace.getActiveSpan()?.spanContext().traceId,
    }),
  },
});
```

## Niveles y cuándo usarlos

| Nivel   | Uso                                               | Ejemplo                                                |
| ------- | ------------------------------------------------- | ------------------------------------------------------ |
| `fatal` | App no puede continuar                            | Falla al cargar config crítica al boot                 |
| `error` | Algo falló inesperadamente, alguien debería verlo | Excepción no manejada, infra failure                   |
| `warn`  | Algo raro pero recuperable                        | Cache miss costoso, retry exitoso                      |
| `info`  | Eventos de negocio relevantes                     | User registered, login success/fail, payment processed |
| `debug` | Detalles de developer                             | Variables intermedias, branches tomadas                |
| `trace` | Diagnóstico fino                                  | Request payload completo (con redacciones)             |

Default prod: `info`. Si necesitas `debug` en prod, hazlo selectivo (un endpoint, un user, vía feature flag) — nunca global.

## Structured logging

**Mal**:

```ts
logger.info(`User ${user.email} logged in from ${ip}`);
```

**Bien**:

```ts
logger.info({ userId: user.id, ip, event: 'auth.login.success' }, 'User logged in');
```

Razones:

- Mensaje constante = agregable en dashboards.
- Campos en propiedades = filtrables sin regex.
- PII (`email`) reemplazable por `userId` que es opaque.

## Correlation ID

```ts
// shared/presentation/interceptors/correlation-id.interceptor.ts
@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx.switchToHttp().getRequest();
    req.id = req.headers['x-request-id'] ?? randomUUID();
    res.setHeader('x-request-id', req.id);
    return next.handle();
  }
}
```

`pino-http` incluye `req.id` automáticamente en cada log. Si el cliente envía `X-Request-Id`, lo respetamos (útil para correlación cross-service).

## Request lifecycle logs

`nestjs-pino` ya logea automáticamente request inicial + response con duración. **No** loggear manualmente "incoming request" — duplica.

## Logs prohibidos

- Passwords / hashes.
- JWT tokens (incluso access tokens cortos).
- Cookies con session.
- API keys / secretos.
- PII no anonimizada (email full, nombre completo, dirección).

Use `redact` paths arriba para enforcement automático.

## Logs por bounded context

Cada use case que emite eventos de negocio loggea con campo `event`:

- `auth.register.success`
- `auth.register.failed`
- `auth.login.success`
- `auth.login.failed`
- `auth.login.locked`
- `auth.refresh.rotated`
- `auth.refresh.reuse_detected`
- `rbac.permission.denied`

Estos son **eventos de auditoría** — deberían persistirse externamente (ELK/Loki) con retención >= 90 días para compliance.

## Performance

pino agrega ~5–10μs por log. Aún así:

- No `JSON.stringify` manual; pino lo hace eficientemente.
- No serializar objetos enormes (Prisma rows con relations) — tomar solo lo necesario.
- En hot loops, `logger.isLevelEnabled('debug')` antes de armar el payload caro.
