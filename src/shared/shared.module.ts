import { Global, Module } from '@nestjs/common';
import { CLOCK } from './application/ports/clock.port';
import { EVENT_BUS } from './application/ports/event-bus.port';
import { SystemClock } from './infrastructure/clock/system-clock';
import { InMemoryEventBus } from './infrastructure/event-bus/in-memory-event-bus';

@Global()
@Module({
  providers: [
    SystemClock,
    InMemoryEventBus,
    { provide: CLOCK, useExisting: SystemClock },
    { provide: EVENT_BUS, useExisting: InMemoryEventBus },
  ],
  exports: [CLOCK, EVENT_BUS],
})
export class SharedModule {}
