import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { RedisService } from '../../../../shared/infrastructure/redis/redis.service';
import type {
  IOAuthStateStore,
  OAuthStatePayload,
} from '../../domain/ports/oauth-state-store.port';

const STATE_TTL_SECONDS = 10 * 60;
const KEY_PREFIX = 'oauth:state:';

/**
 * Persiste OAuth state CSRF en Redis con TTL 10min.
 * Si Redis no está disponible, usa fallback en memoria (solo para dev/test single-pod).
 */
@Injectable()
export class RedisOAuthStateStore implements IOAuthStateStore {
  private readonly fallback = new Map<string, { payload: OAuthStatePayload; expiresAt: number }>();

  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  async issue(payload: OAuthStatePayload): Promise<string> {
    const state = randomBytes(32).toString('base64url');
    if (this.redis.isEnabled()) {
      await this.redis.setJson(KEY_PREFIX + state, payload, STATE_TTL_SECONDS);
    } else {
      this.fallback.set(state, {
        payload,
        expiresAt: Date.now() + STATE_TTL_SECONDS * 1000,
      });
    }
    return state;
  }

  async consume(state: string): Promise<OAuthStatePayload | null> {
    if (typeof state !== 'string' || state.length === 0) return null;

    if (this.redis.isEnabled()) {
      const key = KEY_PREFIX + state;
      const payload = await this.redis.getJson<OAuthStatePayload>(key);
      if (payload) await this.redis.del(key);
      return payload;
    }

    const entry = this.fallback.get(state);
    if (!entry) return null;
    this.fallback.delete(state);
    if (entry.expiresAt < Date.now()) return null;
    return entry.payload;
  }
}
