import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOkResponse({
    schema: {
      example: {
        status: 'ok',
        uptimeSec: 123.45,
        timestamp: '2025-12-23T16:00:00.000Z',
        db: { ok: true },
        redis: { ok: true, enabled: true },
      },
    },
  })
  async getHealth() {
    return this.healthService.check();
  }
}
