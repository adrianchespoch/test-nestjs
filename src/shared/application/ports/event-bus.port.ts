import type { DomainEvent } from '../../domain/domain-event';

export type EventHandler<E extends DomainEvent = DomainEvent> = (event: E) => Promise<void> | void;

export interface IEventBus {
  publish(events: DomainEvent[]): Promise<void>;
  subscribe<E extends DomainEvent = DomainEvent>(eventName: string, handler: EventHandler<E>): void;
}

export const EVENT_BUS = Symbol('IEventBus');
