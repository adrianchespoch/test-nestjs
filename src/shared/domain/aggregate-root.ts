import { Entity } from './entity';
import type { DomainEvent } from './domain-event';
import type { ValueObject } from './value-object';

/**
 * AggregateRoot — única puerta de entrada a un cluster consistente.
 *
 * Acumula DomainEvents internamente; el use case los toma con `pullEvents()`
 * después de persistir y los publica vía el EventBus.
 */
export abstract class AggregateRoot<
  TId extends ValueObject<{ value: string }>,
> extends Entity<TId> {
  private _events: DomainEvent[] = [];

  protected addEvent(event: DomainEvent): void {
    this._events.push(event);
  }

  /** Devuelve y limpia los eventos pendientes. Idempotente: una vez consumidos, no reaparecen. */
  pullEvents(): DomainEvent[] {
    const events = this._events;
    this._events = [];
    return events;
  }

  /** Sólo lectura, sin consumir. Útil para asserts en tests. */
  get pendingEvents(): readonly DomainEvent[] {
    return this._events;
  }
}
