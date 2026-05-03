import type { ValueObject } from './value-object';

/**
 * Entity con identidad estable.
 * El TId se modela como ValueObject para forzar que el id pase por validación
 * (UuidV4 VO, por ejemplo).
 */
export abstract class Entity<TId extends ValueObject<{ value: string }>> {
  protected readonly _id: TId;

  protected constructor(id: TId) {
    this._id = id;
  }

  get id(): TId {
    return this._id;
  }

  equals(other?: Entity<TId> | null): boolean {
    if (other === null || other === undefined) return false;
    if (this === other) return true;
    if (other.constructor !== this.constructor) return false;
    return this._id.equals(other._id);
  }
}
