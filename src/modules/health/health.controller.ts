import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheck,
  HealthCheckService,
  type HealthIndicatorResult,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { RedisService } from '../../shared/infrastructure/redis/redis.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  @Get('live')
  @ApiOkResponse({
    schema: {
      example: { status: 'ok', uptimeSec: 12.3 },
    },
  })
  live(): { status: 'ok'; uptimeSec: number } {
    return { status: 'ok', uptimeSec: (Date.now() - this.startedAt) / 1000 };
  }

  @Get('ready')
  @HealthCheck()
  @ApiOkResponse({ description: 'Service is ready to receive traffic.' })
  @ApiServiceUnavailableResponse({ description: 'A dependency is unavailable.' })
  async ready() {
    const redisRequired = this.config.get<string>('REDIS_REQUIRED') !== 'false';
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
      async (): Promise<HealthIndicatorResult> => {
        if (!redisRequired) return { redis: { status: 'up', enabled: false } };
        const ok = await this.redis.ping();
        return {
          redis: ok
            ? { status: 'up', enabled: true }
            : { status: 'down', enabled: this.redis.isEnabled() },
        };
      },
      async (): Promise<HealthIndicatorResult> => ({
        meta: {
          status: 'up',
          uptimeSec: (Date.now() - this.startedAt) / 1000,
          commit: this.config.get<string>('COMMIT_SHA') ?? 'unknown',
          startedAt: new Date(this.startedAt).toISOString(),
        },
      }),
    ]);
  }
}
