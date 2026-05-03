import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { LRUCache } from 'lru-cache';
import type { RawRuleOf } from '@casl/ability';
import { REDIS_CLIENT } from '../../../../shared/infrastructure/redis/redis.constants';
import type { AppAbility } from './app-ability';

const GEN_KEY = 'rbac:abilities:gen';
const REMOTE_PREFIX = 'rbac:ability:user';
const INVALIDATE_CHANNEL = 'rbac:abilities:invalidated';

const REMOTE_TTL_SECONDS = 10 * 60;
const LOCAL_TTL_MS = 60 * 1000; // L1 más agresivo: 1 min
const LOCAL_MAX = 1000;

interface LocalEntry {
  ability: AppAbility;
  gen: number;
}

/**
 * Two-tier cache para AppAbility:
 *   L1 LRU in-memory (1 min, 1000 entries)
 *   L2 Redis (10 min, compartido entre pods)
 *
 * Invalidación O(1) cross-pod vía generation counter:
 *   - Cada cambio en roles/permisos hace INCR `rbac:abilities:gen` y publica el nuevo
 *     número en `rbac:abilities:invalidated`.
 *   - Pods suscritos clearan su L1 al recibir el mensaje.
 *   - Las keys L2 incluyen `gen` en el sufijo, así keys viejas quedan huérfanas y
 *     expiran solas por TTL — no necesitamos SCAN/DEL costoso.
 *
 * Si Redis no está disponible, el store actúa solo con L1 y la invalidación es
 * local al pod (no cross-pod). Útil para dev/test.
 */
@Injectable()
export class AbilityCacheStore implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AbilityCacheStore.name);
  private readonly local = new LRUCache<string, LocalEntry>({
    max: LOCAL_MAX,
    ttl: LOCAL_TTL_MS,
  });
  private currentGen = 0;
  private subscriber: Redis | null = null;

  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis | null) {}

  async onModuleInit(): Promise<void> {
    if (!this.client) return;
    try {
      const stored = await this.client.get(GEN_KEY);
      this.currentGen = stored ? Number(stored) : 0;
      this.subscriber = this.client.duplicate();
      await this.subscriber.subscribe(INVALIDATE_CHANNEL);
      this.subscriber.on('message', (_channel: string, message: string) => {
        const next = Number(message);
        if (Number.isFinite(next) && next > this.currentGen) {
          this.currentGen = next;
        }
        this.local.clear();
      });
    } catch (err) {
      this.logger.warn({ err }, 'cache_init_failed; degraded to local-only');
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.subscriber?.quit();
    } catch {
      // ignore — connection may already be closed
    }
  }

  get gen(): number {
    return this.currentGen;
  }

  /** L1 hit; ignora si la entrada es de una generación previa. */
  getLocal(userId: string): AppAbility | null {
    const entry = this.local.get(userId);
    if (!entry || entry.gen !== this.currentGen) return null;
    return entry.ability;
  }

  setLocal(userId: string, ability: AppAbility): void {
    this.local.set(userId, { ability, gen: this.currentGen });
  }

  async getRemote(userId: string): Promise<RawRuleOf<AppAbility>[] | null> {
    if (!this.client) return null;
    try {
      const raw = await this.client.get(this.remoteKey(userId));
      if (!raw) return null;
      return JSON.parse(raw) as RawRuleOf<AppAbility>[];
    } catch (err) {
      this.logger.warn({ err, userId }, 'cache_remote_get_failed');
      return null;
    }
  }

  async setRemote(userId: string, rules: RawRuleOf<AppAbility>[]): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.set(
        this.remoteKey(userId),
        JSON.stringify(rules),
        'EX',
        REMOTE_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.warn({ err, userId }, 'cache_remote_set_failed');
    }
  }

  /**
   * Invalida globalmente. Llamado tras cualquier cambio en roles/permisos.
   * - Sin Redis: solo limpia L1 local.
   * - Con Redis: INCR + PUBLISH; todos los pods reciben el mensaje y limpian su L1.
   *   Las keys L2 viejas quedan huérfanas y expiran (no las borramos manualmente).
   */
  async publishInvalidation(): Promise<number> {
    if (!this.client) {
      this.currentGen += 1;
      this.local.clear();
      return this.currentGen;
    }
    try {
      const next = await this.client.incr(GEN_KEY);
      this.currentGen = next;
      this.local.clear();
      await this.client.publish(INVALIDATE_CHANNEL, String(next));
      return next;
    } catch (err) {
      this.logger.error({ err }, 'cache_invalidate_publish_failed');
      // Fallback: al menos invalida local
      this.currentGen += 1;
      this.local.clear();
      return this.currentGen;
    }
  }

  private remoteKey(userId: string): string {
    return `${REMOTE_PREFIX}:${userId}:${this.currentGen}`;
  }
}
