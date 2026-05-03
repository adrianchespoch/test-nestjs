import { Email } from '../../../../../src/modules/auth/domain/value-objects/email';

describe('Email VO', () => {
  it('accepts a valid email and lowercases it', () => {
    const r = Email.create('Alice@Example.COM');
    expect(r.isOk()).toBe(true);
    if (r.isOk()) expect(r.value.value).toBe('alice@example.com');
  });

  it('trims surrounding whitespace', () => {
    const r = Email.create('  bob@example.com  ');
    if (r.isOk()) expect(r.value.value).toBe('bob@example.com');
  });

  it.each(['', 'no-at-sign', 'a@b', 'a@b.c', '@x.com', 'a@.com', 'a b@x.com'])(
    'rejects malformed input %p',
    (raw) => {
      const r = Email.create(raw);
      expect(r.isErr()).toBe(true);
    },
  );

  it('rejects too-long emails', () => {
    const long = 'a'.repeat(250) + '@x.com';
    const r = Email.create(long);
    expect(r.isErr()).toBe(true);
  });

  it('rejects non-string inputs', () => {
    expect(Email.create(123 as unknown).isErr()).toBe(true);
    expect(Email.create(null as unknown).isErr()).toBe(true);
    expect(Email.create(undefined as unknown).isErr()).toBe(true);
  });

  it('two emails with different case are equal as VOs', () => {
    const a = Email.create('Foo@bar.com');
    const b = Email.create('foo@BAR.com');
    if (a.isOk() && b.isOk()) expect(a.value.equals(b.value)).toBe(true);
  });
});
