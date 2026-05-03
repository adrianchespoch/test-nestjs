import { Global, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis | null => {
        const url = config.get<string>('REDIS_URL');
        if (!url) return null;
        const logger = new Logger('RedisClient');
        const client = new Redis(url, {
          maxRetriesPerRequest: 2,
          enableReadyCheck: true,
          lazyConnect: false,
        });
        client.on('error', (err) => logger.warn(`redis error: ${err.message}`));
        return client;
      },
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    // ioredis quit handled per-instance; provider factory holds the singleton
  }
}
