import { ValueObject } from '../../../../src/shared/domain/value-object';

class Email extends ValueObject<{ value: string }> {
  static create(raw: string): Email {
    return new Email({ value: raw.toLowerCase() });
  }
  get value() {
    return this.props.value;
  }
}

class PhoneNumber extends ValueObject<{ value: string }> {
  static create(raw: string): PhoneNumber {
    return new PhoneNumber({ value: raw });
  }
}

describe('ValueObject', () => {
  it('equality is by value, not reference', () => {
    const a = Email.create('Alice@Example.com');
    const b = Email.create('alice@example.com');
    expect(a).not.toBe(b);
    expect(a.equals(b)).toBe(true);
  });

  it('different values are not equal', () => {
    expect(Email.create('a@x.com').equals(Email.create('b@x.com'))).toBe(false);
  });

  it('same value but different class are not equal', () => {
    const email = Email.create('foo@bar.com');
    const phone = PhoneNumber.create('foo@bar.com');
    expect(email.equals(phone as unknown as Email)).toBe(false);
  });

  it('null/undefined comparisons return false', () => {
    expect(Email.create('a@x.com').equals(null)).toBe(false);
    expect(Email.create('a@x.com').equals(undefined)).toBe(false);
  });

  it('props are frozen (immutable)', () => {
    const e = Email.create('foo@bar.com');
    expect(() => {
      // @ts-expect-error: intentional, we want to assert it throws/no-op
      e.props.value = 'mutated';
    }).toThrow();
    expect(e.value).toBe('foo@bar.com');
  });
});
