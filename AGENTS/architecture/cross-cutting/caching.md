# Cross-cutting — Caching

## Filosofía

- **Read-through + invalidate-on-write** como pattern default (mismo que el repo legacy demuestra).
- Cache **opcional**: la app debe funcionar sin Redis (degradada). Si Redis cae, los reads van a DB.
- TTL como safety net, **no** como primary invalidation.

## Layers

| Layer                     | Where                | TTL    | Examples                                           |
| ------------------------- | -------------------- | ------ | -------------------------------------------------- |
| HTTP cache headers        | Response headers     | 0–60s  | `Cache-Control: private, max-age=30` para listings |
| Application cache (Redis) | `RedisService`       | 30s–1h | User listing con tasks, ability cache              |
| ORM-level                 | Prisma (no built-in) | —      | No usado                                           |
| DB query cache            | Postgres planner     | —      | Implícito                                          |

## RedisService API

```ts
interface IRedisService {
  isEnabled(): boolean;
  getJson<T>(key: string): Promise<T | null>;
  setJson(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  delPrefix(prefix: string): Promise<void>; // SCAN + DEL
  publish(channel: string, message: string): Promise<void>;
  subscribe(channel: string, handler: (msg: string) => void): Promise<void>;
}
```

Implementación tolera ausencia de Redis: si no hay client, todos los reads devuelven `null` y los writes son no-op (con log warn).

## Key conventions

```
{context}:{aggregate}:{operation}:{params...}
```

Ejemplos:

- `users:list:all_with_tasks`
- `users:byId:{userId}`
- `rbac:ability:user:{userId}`
- `auth:lockout:{email_hash}`

Nunca usar `email` raw en keys — hash con SHA-256 (no PII en Redis logs/exports).

## Invalidation rules

**Cada mutación invalida**:

1. La key específica del recurso (`users:byId:{id}`).
2. La key del listing afectado (`users:list:all_with_tasks`).
3. Cualquier key derivada (`rbac:ability:user:{id}` si el rol cambió).

Pattern en use case:

```ts
class UpdateUserUseCase {
  async execute(input) {
    const result = await this.uow.execute(async (tx) => {
      // ... lógica de dominio
      await this.users.save(user, tx);
    });
    // Invalidate AFTER commit
    await this.cache.del(`users:byId:${user.id}`);
    await this.cache.del(`users:list:all_with_tasks`);
    return result;
  }
}
```

**Regla**: invalidación **después** de commit. Si invalidas antes y commit falla, el cache queda desincronizado.

## TTL guidelines

- **30s–1m**: listings que cambian frecuentemente y son tolerables a stale.
- **5m–15m**: read models que cambian poco (config, perfiles que no se editan a menudo).
- **1h+**: reference data (lista de países, tipos de cambio congelados).
- **Sin TTL** + invalidate-on-write: **prohibido**. Siempre TTL como safety net por si la invalidación falla.

## Stampede protection

Si una key cara expira y llegan 100 requests simultáneos, todos hacen el query a DB. Mitigaciones:

1. **Lock con SETNX**: el primer request adquiere lock, el resto espera (timeout corto) y re-checkea cache.
2. **Probabilistic early refresh**: ~10% antes del TTL, refresh en background.

Para v1 del skeleton: simple TTL sin protection; agregar lock cuando un endpoint específico lo justifique (medido).

## Anti-patterns

- **Cache de write-through sincrónico**: escribir a cache y DB en cada write — overhead alto, inconsistencias en falla parcial. No.
- **Cache invalidation con timer**: setTimeout para borrar — no resiste reinicios. No.
- **Cache de queries con WHERE complejos**: cachear `users WHERE active=true AND age>21 AND ...` — la combinatoria explota. Mejor cachear el dataset bruto y filtrar en memoria si vale la pena.
- **Almacenar entidades enteras con relations grandes**: pesado en memoria. Cachear projections (DTOs específicas), no aggregates completos.

## Ability cache (RBAC)

Ver [`ADR-005`](../../planning/decisions/ADR-005-casl-rbac-abac.md). Specifics:

- Key: `rbac:ability:user:{userId}`
- TTL: 10 min
- Invalidación: pub/sub Redis canal `rbac:role-changed:{roleId}` → cada pod borra abilities de users con ese rol (que tiene en memoria).

## Memoria local (LRU) opcional

Para datos hot-hot (config, ability del request actual): `lru-cache` en memoria del proceso. Nunca como primary — Redis sigue siendo source of truth. LRU local es L1, Redis L2.

## Métricas

Ver [`observability.md`](./observability.md):

- `cache_hits_total{key_prefix}`
- `cache_misses_total{key_prefix}`
- Hit ratio < 50% sugiere TTL bajo o pattern incorrecto.
