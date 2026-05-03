import { CompositeSpecification } from '../../../../src/shared/domain/specification';

interface User {
  emailVerified: boolean;
  isActive: boolean;
  age: number;
}

class IsVerified extends CompositeSpecification<User> {
  isSatisfiedBy(u: User): boolean {
    return u.emailVerified;
  }
}
class IsActive extends CompositeSpecification<User> {
  isSatisfiedBy(u: User): boolean {
    return u.isActive;
  }
}
class IsAdult extends CompositeSpecification<User> {
  isSatisfiedBy(u: User): boolean {
    return u.age >= 18;
  }
}

const aVerifiedActiveAdult: User = { emailVerified: true, isActive: true, age: 30 };
const anUnverifiedUser: User = { emailVerified: false, isActive: true, age: 30 };
const aMinor: User = { emailVerified: true, isActive: true, age: 15 };

describe('Specification', () => {
  it('isSatisfiedBy evaluates the rule', () => {
    expect(new IsVerified().isSatisfiedBy(aVerifiedActiveAdult)).toBe(true);
    expect(new IsVerified().isSatisfiedBy(anUnverifiedUser)).toBe(false);
  });

  it('and combines two specs (true only if both)', () => {
    const spec = new IsVerified().and(new IsActive());
    expect(spec.isSatisfiedBy(aVerifiedActiveAdult)).toBe(true);
    expect(spec.isSatisfiedBy(anUnverifiedUser)).toBe(false);
  });

  it('or combines two specs (true if any)', () => {
    const spec = new IsVerified().or(new IsAdult());
    expect(spec.isSatisfiedBy(anUnverifiedUser)).toBe(true);
    expect(spec.isSatisfiedBy({ ...aMinor, emailVerified: false })).toBe(false);
  });

  it('not negates the spec', () => {
    const spec = new IsAdult().not();
    expect(spec.isSatisfiedBy(aMinor)).toBe(true);
    expect(spec.isSatisfiedBy(aVerifiedActiveAdult)).toBe(false);
  });

  it('compositions chain', () => {
    const eligibleAdult = new IsVerified().and(new IsActive()).and(new IsAdult());
    expect(eligibleAdult.isSatisfiedBy(aVerifiedActiveAdult)).toBe(true);
    expect(eligibleAdult.isSatisfiedBy(aMinor)).toBe(false);
    expect(eligibleAdult.isSatisfiedBy(anUnverifiedUser)).toBe(false);
  });
});
