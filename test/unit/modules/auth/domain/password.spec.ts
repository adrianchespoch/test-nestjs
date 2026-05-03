import {
  HashedPassword,
  Password,
} from '../../../../../src/modules/auth/domain/value-objects/password';

describe('Password VO', () => {
  describe('Password.create', () => {
    it('accepts a strong password', () => {
      const r = Password.create('Str0ng-Pass!2026');
      expect(r.isOk()).toBe(true);
    });

    it('rejects when too short', () => {
      const r = Password.create('Sh0rt!a');
      expect(r.isErr()).toBe(true);
      if (r.isErr()) expect(r.error.message).toMatch(/at least/);
    });

    it('rejects when too long', () => {
      const r = Password.create('A1!' + 'a'.repeat(200));
      expect(r.isErr()).toBe(true);
    });

    it('rejects when fewer than 3 character classes', () => {
      // only lowercase + digit = 2 classes
      const r = Password.create('alllowercase123');
      expect(r.isErr()).toBe(true);
    });

    it('accepts when 3 of 4 classes present', () => {
      // lower + upper + digit (no symbol)
      const r = Password.create('GoodPassword2026');
      expect(r.isOk()).toBe(true);
    });

    it('rejects non-string inputs', () => {
      expect(Password.create(undefined as unknown).isErr()).toBe(true);
      expect(Password.create(123 as unknown).isErr()).toBe(true);
    });
  });

  describe('HashedPassword.fromHash', () => {
    it('wraps a non-empty string', () => {
      const hp = HashedPassword.fromHash('$argon2id$something');
      expect(hp.value).toBe('$argon2id$something');
    });

    it('throws on empty string', () => {
      expect(() => HashedPassword.fromHash('')).toThrow();
    });
  });
});
