import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  async check() {
    const now = new Date();

    const db = await this.pingDb();
    const redis = await this.pingRedis();

    const overallOk = db.ok && (redis.enabled ? redis.ok : true);

    return {
      status: overallOk ? 'ok' : 'degraded',
      uptimeSec: process.uptime(),
      timestamp: now.toISOString(),
      db,
      redis,
    };
  }

  private async pingDb(): Promise<{ ok: boolean; error?: string }> {
    try {
      // SELECT 1
      await this.dataSource.query('SELECT 1');
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'DB ping failed' };
    }
  }

  private async pingRedis(): Promise<{
    enabled: boolean;
    ok: boolean;
    error?: string;
  }> {
    const enabled = this.redisService.isEnabled();
    if (!enabled) return { enabled: false, ok: true };

    try {
      const key = 'health:ping';
      await this.redisService.setJson(key, { t: Date.now() }, 5);
      await this.redisService.getJson(key);
      return { enabled: true, ok: true };
    } catch (e: any) {
      return {
        enabled: true,
        ok: false,
        error: e?.message ?? 'Redis ping failed',
      };
    }
  }
}
