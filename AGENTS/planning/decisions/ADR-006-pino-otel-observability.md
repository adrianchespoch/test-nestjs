# ADR-006 — Observabilidad: pino + OpenTelemetry desde día uno

**Status**: Accepted (Mayo 2026)

## Context

Toda la observabilidad post-mortem (logs JSON sin estructura, sin traceId, sin métricas) es excusa para no instrumentar desde el inicio. El skeleton debe arrancar con:

- **Logs**: estructurados (JSON), correlacionados con trace, performant.
- **Tracing**: spans automáticos para HTTP in/out, DB, Redis, queues.
- **Metrics**: latencias p50/p95/p99 por endpoint, error rate, queue depth.
- **Backend-agnostic**: exportar OTLP para que cualquier vendor (Datadog, Honeycomb, Grafana Tempo, Sentry) lo consuma.

## Decision

**Stack**:

- **Logger**: `nestjs-pino`. Reemplaza el logger nativo de Nest. Configurado con `pino-opentelemetry-transport` para que cada log lleve `traceId` y `spanId`.
- **Tracing/metrics**: `@opentelemetry/sdk-node` (auto-instrumentation) + `nestjs-otel` (decoradores `@Span`, `@Counter`, etc.).
- **Inicialización**: el SDK OTel se inicializa **antes** de `NestFactory.create` en `main.ts`. Si no, las instrumentaciones automáticas no enganchan.

```ts
// main.ts — orden importa
import './otel'; // inicializa SDK ANTES de cualquier import de nest
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

bootstrap();
```

**Correlation**:

- Middleware genera `requestId` (uuid v7) si no viene en header `X-Request-Id`.
- pino child logger con `{ requestId, traceId }` por request, expuesto vía `LoggerModule.forRoot({ pinoHttp: ... })`.

**Métricas obligatorias** (decoradores en use cases o controllers):

- `http_requests_total{method, route, status}`
- `http_request_duration_seconds{method, route}` (histogram)
- `auth_login_attempts_total{result}` (success/fail/locked)
- `db_query_duration_seconds{operation}`

**Retención**:

- Logs: 30 días en backend (Loki/CloudWatch/Datadog).
- Traces: sampling 100% en dev, 10% en prod (con tail-based para errores).
- Metrics: 13 meses raw + agregados perpetuos.

## Consequences

**Positivas**:

- Cada incidente tiene traceId que cruza HTTP → DB → cache → external API.
- Logs no requieren parser custom (JSON estándar).
- pino es el logger Node más rápido (≈10K logs/s, ~115ms para 10K vs ~270ms Winston).
- Backend-swap sin tocar código (cambiar `OTEL_EXPORTER_OTLP_ENDPOINT`).

**Negativas / mitigaciones**:

- **Inicialización quirky**: OTel debe cargarse antes de Nest. Mitigación: archivo `otel.ts` separado importado primero, no como side-effect de un módulo.
- **Costo de tracing 100%**: 10% sampling en prod. Errores siempre 100% (tail sampling).
- **Cardinality blow-up**: rutas con IDs en path explotan métricas. Mitigación: `nestjs-otel` resuelve a la ruta sin params (`/users/:id` no `/users/123`).
- **PII en logs**: passwords, tokens, PII no deben loggearse. Mitigación: `redact` config en pino con paths conocidos (`req.headers.authorization`, `req.body.password`, etc.). Code review enforcement.

## Referencias

- `nestjs-pino` (`@iamolegga/nestjs-pino`).
- OpenTelemetry JS SDK docs.
- `pragmaticivan/nestjs-otel`.
