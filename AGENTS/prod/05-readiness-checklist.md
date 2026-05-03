# 05 — Production readiness checklist

Este checklist se completa **antes** del primer deploy a prod. Revisado trimestralmente para drift.

## Security

### OWASP Top 10 (2023+ revision)

- [ ] **A01 Broken Access Control**: CASL en todos los endpoints; tests cubren denial cases.
- [ ] **A02 Cryptographic Failures**: TLS 1.3 only; secrets en secret manager; argon2id passwords.
- [ ] **A03 Injection**: Prisma parametrized queries; ValidationPipe global; no raw SQL con user input.
- [ ] **A04 Insecure Design**: ADRs documentan decisiones; threat model revisado.
- [ ] **A05 Security Misconfiguration**: helmet activo; CORS lista blanca; .env.example sin secrets reales.
- [ ] **A06 Vulnerable Components**: Snyk/Trivy en CI; Renovate/Dependabot activo.
- [ ] **A07 Auth Failures**: refresh rotation + theft detection; lockout; argon2id; OAuth state.
- [ ] **A08 Data Integrity Failures**: Conventional Commits + signed commits; package-lock.json/pnpm-lock.yaml en repo.
- [ ] **A09 Logging Failures**: Logs JSON con redact; trace correlation; audit log para acciones críticas.
- [ ] **A10 SSRF**: outbound requests con allowlist; rangos privados bloqueados.

### Otros

- [ ] Penetration test ejecutado (ZAP baseline mínimo en CI).
- [ ] Dependency licenses revisadas (no GPL en código propietario).
- [ ] PII identificada y minimizada.
- [ ] GDPR / CCPA: data export y data deletion endpoints implementados (si aplica).
- [ ] Rate limiting en endpoints sensibles (login, register, password reset).
- [ ] CSRF mitigado (SameSite + Origin check).

## Reliability

- [ ] Health checks: `/live` y `/ready` distintos.
- [ ] Graceful shutdown probado (SIGTERM → drain → close).
- [ ] Connection pooling: DB y Redis con limits razonables.
- [ ] Timeouts en TODOS los outbound HTTP calls.
- [ ] Circuit breakers en integraciones críticas (opcional v1).
- [ ] Retries con backoff exponencial donde aplique.
- [ ] DB backup PITR habilitado.
- [ ] Backup restore ensayado en staging con dump real.

## Observability

- [ ] Logs estructurados JSON.
- [ ] Trace IDs propagados en logs.
- [ ] OTel exporter configurado y datos llegando al backend.
- [ ] Métricas básicas: HTTP request rate/duration/status, DB query duration, cache hit rate, auth events.
- [ ] Dashboards: API health, business KPIs (registrations, logins).
- [ ] Alertas: 5xx rate > X%, p95 > Y ms, DB connections > Z%, refresh-reuse detected.
- [ ] On-call rotation configurada (PagerDuty / Opsgenie).
- [ ] Runbook por alerta (cada alert tiene `runbook_url`).

## Performance

- [ ] Smoke load test ejecutado (k6 / Artillery): N RPS sostenidos, p95 < SLA.
- [ ] N+1 queries auditadas en endpoints frecuentes.
- [ ] Indexes en columnas de WHERE/JOIN frecuentes.
- [ ] Cache hit rate > 50% en endpoints cacheables.
- [ ] Static assets en CDN (si aplica).
- [ ] Compresión (gzip/brotli) habilitada en proxy.

## Operability

- [ ] Single command deploy.
- [ ] Rollback documentado y rápido (< 5 min).
- [ ] Migration runbook ensayado.
- [ ] Incident runbook leído por el equipo.
- [ ] Status page configurada.
- [ ] Comunicación con stakeholders documentada.

## Compliance / legal (si aplica)

- [ ] Privacy policy publicada.
- [ ] Terms of service publicados.
- [ ] Cookie banner (GDPR) si users en EU.
- [ ] Audit log inmutable de eventos críticos (login, role assignment, etc.) con retención >= 1y.
- [ ] Data retention policy documentada (cuándo borrar PII).
- [ ] Right to erasure: endpoint para borrar cuenta + datos asociados.

## Documentation

- [ ] README con quickstart funciona desde cero (`pnpm install && pnpm dev`).
- [ ] API documentada en Swagger; URL pública (o link interno).
- [ ] ADRs actualizados con cualquier desviación del diseño.
- [ ] Postmortems indexados.
- [ ] Onboarding doc para nuevos devs (< 1 día para hacer primer commit útil).

## Cost

- [ ] Estimación de costo a 100K MAU calculada.
- [ ] Alarmas en gasto cloud (presupuesto mensual).
- [ ] Egress traffic monitoreado.

## Pre-launch smoke tests

Ejecutar contra staging con datos reales:

```sh
# Health
curl -sf https://staging.example.com/api/health/ready | jq

# Register
curl -X POST https://staging.example.com/api/auth/register \
  -H 'content-type: application/json' \
  -d '{"name":"Smoke","email":"smoke@test.com","password":"Pass-123!"}'

# Login
TOKEN=$(curl -X POST https://staging.example.com/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"smoke@test.com","password":"Pass-123!"}' | jq -r .accessToken)

# Authed call
curl -sf https://staging.example.com/api/users/me -H "authorization: Bearer $TOKEN"

# OAuth redirect
curl -sf -o /dev/null -w '%{http_code}\n' https://staging.example.com/api/auth/google
# debería retornar 302 con location a accounts.google.com
```

Todos green = ready. Cualquier red = bloquea launch.

## Sign-off

Firmas requeridas antes de primer deploy a prod:

- [ ] Tech Lead
- [ ] Engineering Manager
- [ ] Security (si la org tiene equipo dedicado)
- [ ] DBA / SRE (si la org los tiene)

Documento del sign-off en repo (`docs/launch-readiness-<date>.md`) o sistema de la organización.
