import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import IORedis from 'ioredis';

import { envSchema } from './config/env.schema';
import { GlobalExceptionFilter } from './shared/application/filters/global-exception.filter';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';
import { RedisModule } from './shared/infrastructure/redis/redis.module';
import { CorrelationIdInterceptor } from './shared/presentation/interceptors/correlation-id.interceptor';
import { SharedModule } from './shared/shared.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { RbacModule } from './modules/rbac/rbac.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: envSchema,
      validationOptions: { abortEarly: false, allowUnknown: true },
    }),

    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        genReqId: (req, res) => {
          const incoming = req.headers['x-request-id'];
          const id = typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
        transport:
          process.env.NODE_ENV === 'dev'
            ? {
                target: 'pino-pretty',
                options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l' },
              }
            : undefined,
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.currentPassword',
            'req.body.newPassword',
            'res.headers["set-cookie"]',
          ],
          censor: '[REDACTED]',
        },
        serializers: {
          req: (req) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            remoteAddress: req.remoteAddress,
          }),
        },
      },
    }),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL');
        // Storage compartido entre pods. Si no hay Redis URL → in-memory (single-pod).
        const storage = url
          ? new ThrottlerStorageRedisService(new IORedis(url, { maxRetriesPerRequest: 2 }))
          : undefined;
        return {
          throttlers: [
            { name: 'short', ttl: 1000, limit: 20 },
            { name: 'medium', ttl: 60_000, limit: 200 },
            { name: 'long', ttl: 3_600_000, limit: 2000 },
          ],
          ...(storage ? { storage } : {}),
        };
      },
    }),

    SharedModule,
    PrismaModule,
    RedisModule,
    RbacModule,
    AuthModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: CorrelationIdInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
