import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';

import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly client: Redis | null,
  ) {}

  isEnabled(): boolean {
    return !!this.client;
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (!this.client) return null;

    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      this.logger.warn(`Redis getJson failed for key=${key}`);
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.client) return;

    try {
      const payload = JSON.stringify(value);
      await this.client.set(key, payload, 'EX', ttlSeconds);
    } catch {
      this.logger.warn(`Redis setJson failed for key=${key}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.del(key);
    } catch {
      this.logger.warn(`Redis del failed for key=${key}`);
    }
  }
}
