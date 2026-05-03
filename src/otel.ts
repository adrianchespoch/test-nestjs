/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * OpenTelemetry SDK init.
 * MUST be the first import in src/main.ts (otherwise auto-instrumentations
 * miss modules already loaded). Ver `architecture/cross-cutting/observability.md`.
 *
 * Activación condicional: si `OTEL_EXPORTER_OTLP_ENDPOINT` no está seteado, el SDK
 * NO se inicializa — útil para tests/dev rápido.
 *
 * Usamos `require` en lugar de `import` para que las dependencias OTel solo se
 * carguen cuando el SDK realmente se va a iniciar.
 */

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

if (otlpEndpoint && otlpEndpoint.length > 0) {
  const { NodeSDK } = require('@opentelemetry/sdk-node');
  const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
  const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
  const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
  const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');

  const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'nestjs-skeleton',
    traceExporter: new OTLPTraceExporter({
      url: `${otlpEndpoint.replace(/\/$/, '')}/v1/traces`,
    }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: `${otlpEndpoint.replace(/\/$/, '')}/v1/metrics`,
      }),
      exportIntervalMillis: 10_000,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // FS instrumentation es ruidoso y baja la señal/ruido.
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();

  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .catch((err: unknown) => {
        console.error('[otel] shutdown error', err);
      })
      .finally(() => process.exit(0));
  });

  console.log(`[otel] enabled — exporting to ${otlpEndpoint}`);
}
