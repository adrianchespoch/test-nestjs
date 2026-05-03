import { Injectable, Logger } from '@nestjs/common';
import type { DomainEvent } from '../../domain/domain-event';
import type { EventHandler, IEventBus } from '../../application/ports/event-bus.port';

/**
 * EventBus in-memory para v1.
 * Ejecuta handlers de manera secuencial. Errores en un handler se loggean
 * pero no abortan el resto (best-effort delivery).
 *
 * Para guarantees at-least-once cross-process, migrar a un outbox pattern + worker.
 */
@Injectable()
export class InMemoryEventBus implements IEventBus {
  private readonly logger = new Logger(InMemoryEventBus.name);
  private readonly handlers = new Map<string, Array<EventHandler>>();

  async publish(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      const handlers = this.handlers.get(event.name) ?? [];
      for (const handler of handlers) {
        try {
          await handler(event);
        } catch (err) {
          this.logger.error(
            { err, event: event.name, aggregateId: event.aggregateId },
            'event_handler_failed',
          );
        }
      }
    }
  }

  subscribe<E extends DomainEvent = DomainEvent>(
    eventName: string,
    handler: EventHandler<E>,
  ): void {
    const list = this.handlers.get(eventName) ?? [];
    list.push(handler as EventHandler);
    this.handlers.set(eventName, list);
  }
}
