import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis | null) {}

  isEnabled(): boolean {
    return this.client !== null;
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const reply = await this.client.ping();
      return reply === 'PONG';
    } catch {
      return false;
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const raw = await this.client.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      this.logger.warn(`getJson failed for key=${key}`);
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      this.logger.warn(`setJson failed for key=${key}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch {
      this.logger.warn(`del failed for key=${key}`);
    }
  }
}
