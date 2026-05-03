# 04 — Incident runbook

Procedimiento estándar para incidentes de producción. **Léelo antes** del incidente.

## Severidad

| Sev       | Definición                                     | SLA respuesta    |
| --------- | ---------------------------------------------- | ---------------- |
| **SEV-1** | Outage total o data loss en curso              | 5 min, all hands |
| **SEV-2** | Degradación significativa, impacto > 50% users | 15 min           |
| **SEV-3** | Bug puntual, workaround existe                 | 1 día hábil      |
| **SEV-4** | Cosmético, mejora sugerida                     | Sprint normal    |

## Escalación

1. **Detección** → on-call recibe page (Pagerduty/Opsgenie).
2. **Acknowledge** en 5 min: confirma que está mirando.
3. **Open incident channel**: `#incident-YYYYMMDD-HHmm`.
4. **Designar roles**:
   - **Incident Commander (IC)**: coordina, no debugea.
   - **Tech Lead**: investiga.
   - **Communications**: actualiza stakeholders / status page.
5. Si SEV-1/2 > 30 min, escalar a engineering manager.

## First-response checklist

```
[ ] Acknowledge en 5 min
[ ] Crear canal #incident-...
[ ] Asignar IC, Tech Lead, Comms
[ ] Capturar timeline desde el principio (un mensaje por evento, con timestamp)
[ ] Verificar dashboards: error rate, p95 latency, queue depth, DB connections
[ ] Pregunta clave: "qué cambió?" → último deploy, último config change, último DB change
[ ] Decidir: rollback (default) o roll-forward (si hot fix obvio en < 5 min)
```

## Triage por síntoma

### 5xx rate alto

```
1. /health/ready en todos los pods
2. Logs últimos 5 min: error pattern dominante?
3. Métricas DB: connection pool exhausted? slow queries?
4. Métricas Redis: memory? evictions?
5. Si solo afecta una endpoint → bug en código nuevo → rollback
6. Si todo está afectado → infra → DB/Redis check
```

### Latencia alta (p95 > SLA)

```
1. ¿Hay un endpoint en particular? Slow query?
2. Trace en OTel: dónde se gasta el tiempo? (DB, external API, cache miss)
3. ¿Cache hit rate cayó?
4. ¿Queue depth alto? (workers atascados)
5. ¿N+1 introducido en deploy reciente?
```

### DB unreachable

```
1. ¿Conectividad de red? VPC, security groups
2. ¿DB instance up? Provider console
3. ¿Connections maxed out? `SELECT count(*) FROM pg_stat_activity`
4. Si DB está OK pero apps no conectan → DNS issue común
5. Failover (si HA): trigger manual failover si automatic no respondió
```

### Auth-related: many users locked out

```
1. ¿Se cambió la policy de lockout recientemente?
2. ¿Brute force attack? (revisar IPs en logs)
3. Si attack: bloqueo a nivel WAF/load balancer
4. Si bug: revertir y unlock affected users (admin endpoint)
```

### Refresh token reuse alarmas múltiples

```
1. Una alarma = sesión robada de un user específico → notificar al user, force logout, investigar
2. Múltiples alarmas (>10/min) = posible:
   - Bug en cliente (no rota correctamente) → revisar último deploy de frontend
   - Token leak masivo → rotation de keys, force logout-all, security audit
```

## Comandos útiles

```sh
# Ver últimos deploys
kubectl rollout history deployment/api -n prod

# Rollback inmediato
kubectl rollout undo deployment/api -n prod

# Drain pod problemático (k8s lo reemplaza)
kubectl delete pod <pod-name> -n prod

# Logs últimos 5 min de todos los pods
kubectl logs -l app=api -n prod --since=5m --tail=1000

# DB connections activas
psql $DATABASE_URL -c "SELECT count(*), state FROM pg_stat_activity WHERE datname='app' GROUP BY state"

# Slow queries
psql $DATABASE_URL -c "SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 20"

# Redis info
redis-cli -u $REDIS_URL info stats memory clients
```

## Status page

- **Investigating** dentro de 10 min de detección.
- **Identified** cuando se sabe la causa (no cuando está fixed).
- **Monitoring** post-fix.
- **Resolved** cuando 30 min sin recurrencia.

Lenguaje: factual, sin culpa, sin jerga interna.

## Post-mortem (blameless)

Dentro de 5 días hábiles del fin del incidente:

```markdown
# Incident <id>: <one-line summary>

## Impact

- Duration: from <t1> to <t2>
- Users affected: <count or %>
- What broke: <observable behavior>

## Timeline (UTC)

- <t1> — Event detected by <monitor>
- <t1+5m> — On-call ack'd, channel open
- <t1+15m> — Root cause hypothesized
- <t1+25m> — Fix applied (rollback / hot-fix)
- <t2> — Verified resolved

## Root cause

<technical explanation, no individual blame>

## What went well

<observations>

## What went poorly

<gaps in detection, runbooks, monitoring>

## Action items (with owner + due date)

- [ ] Add alerting for X — @alice — 2026-MM-DD
- [ ] Update runbook section Y — @bob — 2026-MM-DD
- [ ] Add test for the regression — @carol — 2026-MM-DD
```

Compartido en todo el equipo. **No** se busca culpable — se busca patrones del sistema.

## Drills

Quarterly:

- **Game day**: simular un incidente conocido (DB down, deploy malo) y ejercitar el runbook.
- **Rotation training**: cada nuevo on-call corre un drill antes de su primera shift solo.
- Update runbook con lo aprendido.
