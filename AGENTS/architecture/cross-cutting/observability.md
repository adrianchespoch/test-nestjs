# Cross-cutting — Observability

> Decisión: ver [`ADR-006`](../../planning/decisions/ADR-006-pino-otel-observability.md).

## Tres pilares

1. **Logs** — eventos discretos. Ver [`logging.md`](./logging.md).
2. **Traces** — flow request-scoped a través de servicios.
3. **Metrics** — agregados temporales (counters, histograms, gauges).

Los tres comparten **traceId** vía OpenTelemetry context propagation.

## Init order (crítico)

```ts
// src/otel.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';

const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME ?? 'nestjs-skeleton',
  traceExporter: new OTLPTraceExporter({ url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter(),
    exportIntervalMillis: 10_000,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false }, // ruidoso
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown().finally(() => process.exit(0));
});
```

```ts
// src/main.ts
import './otel'; // PRIMER import, antes que cualquier otro
import { NestFactory } from '@nestjs/core';
// ...
```

Si OTel se inicializa después de cargar Nest/Prisma, las auto-instrumentations no enganchan los módulos ya cargados.

## Auto-instrumentations habilitadas

- HTTP server (express/fastify)
- HTTP client (fetch, axios)
- pg / Prisma (vía `@prisma/instrumentation`)
- Redis (ioredis)
- DNS (útil para diagnóstico)

Deshabilitadas: `fs` (ruidoso, baja señal).

## Spans manuales

```ts
import { Span } from 'nestjs-otel';

@Injectable()
export class LoginUseCase {
  @Span('auth.login.use_case')
  async execute(input: LoginInput) {
    /* ... */
  }
}
```

O programático:

```ts
const tracer = trace.getTracer('auth');
return tracer.startActiveSpan('auth.token.rotate', async (span) => {
  span.setAttributes({ 'auth.userId': userId });
  try {
    const result = await this.rotate(userId, oldToken);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (err) {
    span.recordException(err);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw err;
  } finally {
    span.end();
  }
});
```

## Métricas obligatorias

Se exponen vía `nestjs-otel`:

```ts
@Injectable()
export class LoginUseCase {
  @Counter('auth_login_attempts_total', { description: 'Login attempts' })
  private attemptCounter: Counter;
}
```

Métricas estándar del skeleton:

- `http_server_duration_seconds{method, route, status}` (histogram)
- `http_server_requests_total{method, route, status}` (counter)
- `auth_login_attempts_total{result=success|fail|locked}` (counter)
- `auth_refresh_rotated_total` (counter)
- `auth_refresh_reuse_detected_total` (counter — trigger alert)
- `db_query_duration_seconds{operation}` (histogram, vía Prisma instrumentation)
- `cache_hits_total{key_prefix}` (counter)
- `cache_misses_total{key_prefix}` (counter)

## Sampling

- **Dev**: 100% (`AlwaysOnSampler`).
- **Prod**: head sampling 10% + tail sampling 100% para errores (vía OTel collector + `tail_sampling_processor`).

## Trace ↔ log correlation

`pino-opentelemetry-transport` o `customProps` inyecta `traceId` y `spanId` en cada log. En el backend:

- Datadog: auto-link via `dd.trace_id`.
- Grafana: link entre Loki y Tempo via labels.
- Honeycomb: trace span con field `trace.id`.

## Health checks ≠ readiness

`@nestjs/terminus`:

- `/health/live` — proceso vivo, no chequea deps. **Nunca falla** salvo crash.
- `/health/ready` — DB + Redis OK + migrations aplicadas. Falla → load balancer saca el pod.

Liveness en k8s con `failureThreshold: 3` y readiness más estricto.

## Cardinality budget

OTel metrics con labels = cardinality. Reglas:

- `route` debe usar el path con params (`/users/:id`), no el concreto (`/users/42`). `nestjs-otel` ya lo resuelve.
- No agregar `userId` ni `tenantId` como label — eso va en traces.
- Cardinality total por métrica < 1000 series.

## Sentry (opcional)

Si el equipo usa Sentry para errores, integrar vía SDK (`@sentry/nestjs`) en paralelo a OTel. Sentry para alerting de excepciones; OTel para todo lo demás. Evitar doble instrumentation HTTP (uno de los dos).
