/**
 * Value Object base — sin identidad, igualdad por valor, inmutable.
 *
 * Subclases hacen que su constructor sea privado y exponen un factory
 * estático `create(...)` que retorna `Result<Self, DomainError>`.
 */
export abstract class ValueObject<Props extends Record<string, unknown>> {
  protected readonly props: Readonly<Props>;

  protected constructor(props: Props) {
    this.props = Object.freeze({ ...props });
  }

  equals(other?: ValueObject<Props> | null): boolean {
    if (other === null || other === undefined) return false;
    if (this === other) return true;
    if (other.constructor !== this.constructor) return false;
    return shallowEqualKeys(this.props, other.props);
  }
}

function shallowEqualKeys<T extends Record<string, unknown>>(a: T, b: T): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (a[k] !== b[k]) return false;
  }
  return true;
}
