/**
 * Specification — encapsula una regla booleana sobre un objeto del dominio.
 * Composable con and/or/not.
 */
export interface Specification<T> {
  isSatisfiedBy(candidate: T): boolean;
  and(other: Specification<T>): Specification<T>;
  or(other: Specification<T>): Specification<T>;
  not(): Specification<T>;
}

export abstract class CompositeSpecification<T> implements Specification<T> {
  abstract isSatisfiedBy(candidate: T): boolean;

  and(other: Specification<T>): Specification<T> {
    return new AndSpecification(this, other);
  }
  or(other: Specification<T>): Specification<T> {
    return new OrSpecification(this, other);
  }
  not(): Specification<T> {
    return new NotSpecification(this);
  }
}

class AndSpecification<T> extends CompositeSpecification<T> {
  constructor(
    private readonly left: Specification<T>,
    private readonly right: Specification<T>,
  ) {
    super();
  }
  isSatisfiedBy(c: T): boolean {
    return this.left.isSatisfiedBy(c) && this.right.isSatisfiedBy(c);
  }
}

class OrSpecification<T> extends CompositeSpecification<T> {
  constructor(
    private readonly left: Specification<T>,
    private readonly right: Specification<T>,
  ) {
    super();
  }
  isSatisfiedBy(c: T): boolean {
    return this.left.isSatisfiedBy(c) || this.right.isSatisfiedBy(c);
  }
}

class NotSpecification<T> extends CompositeSpecification<T> {
  constructor(private readonly wrapped: Specification<T>) {
    super();
  }
  isSatisfiedBy(c: T): boolean {
    return !this.wrapped.isSatisfiedBy(c);
  }
}
