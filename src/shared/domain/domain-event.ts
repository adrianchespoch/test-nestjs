/**
 * DomainEvent — un hecho del pasado del dominio.
 * Inmutable. Su `name` es el subject del bus (ej. 'auth.user.registered').
 */
export interface DomainEvent {
  readonly name: string;
  readonly occurredAt: Date;
  readonly aggregateId: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

/** Helper para clases de evento concretas. */
export abstract class BaseDomainEvent implements DomainEvent {
  readonly occurredAt: Date;
  abstract readonly name: string;
  abstract readonly aggregateId: string;
  abstract readonly payload: Readonly<Record<string, unknown>>;

  protected constructor(occurredAt?: Date) {
    this.occurredAt = occurredAt ?? new Date();
  }
}
