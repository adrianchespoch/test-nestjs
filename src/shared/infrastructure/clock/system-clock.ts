import { Injectable } from '@nestjs/common';
import type { IClock } from '../../application/ports/clock.port';

@Injectable()
export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
}
