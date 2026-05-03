import { Email } from '../../../../../src/modules/auth/domain/value-objects/email';
import { HashedPassword } from '../../../../../src/modules/auth/domain/value-objects/password';
import { User } from '../../../../../src/modules/auth/domain/entities/user';
import {
  AccountDeactivatedError,
  AccountLockedError,
  EmailNotVerifiedError,
  InvalidCredentialsError,
} from '../../../../../src/modules/auth/domain/errors/auth.errors';

const makeEmail = (raw = 'alice@example.com') => {
  const e = Email.create(raw);
  if (e.isErr()) throw e.error;
  return e.value;
};

const makeHash = () => HashedPassword.fromHash('$argon2id$placeholder');

const NOW = new Date('2026-05-03T10:00:00Z');

describe('User aggregate', () => {
  describe('register', () => {
    it('creates an unverified, active user with UserRegistered event', () => {
      const user = User.register({
        email: makeEmail(),
        name: 'Alice',
        passwordHash: makeHash(),
        now: NOW,
      });
      expect(user.email.value).toBe('alice@example.com');
      expect(user.isEmailVerified()).toBe(false);
      expect(user.isActive).toBe(true);
      expect(user.failedLoginAttempts).toBe(0);
      expect(user.pendingEvents.map((e) => e.name)).toEqual(['auth.user.registered']);
    });
  });

  describe('tryLogin — happy path', () => {
    it('returns Ok when email verified and password correct', () => {
      const user = User.register({
        email: makeEmail(),
        name: 'Alice',
        passwordHash: makeHash(),
        now: NOW,
      });
      user.markEmailVerified(NOW);
      user.pullEvents(); // limpia eventos previos

      const r = user.tryLogin({ isPasswordCorrect: true, now: NOW });
      expect(r.isOk()).toBe(true);
      expect(user.failedLoginAttempts).toBe(0);
    });
  });

  describe('tryLogin — invalid credentials & lockout', () => {
    it('increments failed counter on wrong password', () => {
      const user = User.register({
        email: makeEmail(),
        name: 'Alice',
        passwordHash: makeHash(),
        now: NOW,
      });
      user.markEmailVerified(NOW);
      user.pullEvents();

      const r = user.tryLogin({ isPasswordCorrect: false, now: NOW });
      expect(r.isErr()).toBe(true);
      if (r.isErr()) expect(r.error).toBeInstanceOf(InvalidCredentialsError);
      expect(user.failedLoginAttempts).toBe(1);
    });

    it('locks account after 5 consecutive failures', () => {
      const user = User.register({
        email: makeEmail(),
        name: 'Alice',
        passwordHash: makeHash(),
        now: NOW,
      });
      user.markEmailVerified(NOW);

      let result;
      for (let i = 0; i < 5; i++) {
        result = user.tryLogin({ isPasswordCorrect: false, now: NOW });
      }
      expect(result!.isErr()).toBe(true);
      if (result!.isErr()) expect(result!.error).toBeInstanceOf(AccountLockedError);
      expect(user.failedLoginAttempts).toBe(5);
      expect(user.isLocked(NOW)).toBe(true);
      expect(user.pendingEvents.some((e) => e.name === 'auth.account.locked')).toBe(true);
    });

    it('subsequent login during lockout returns AccountLockedError even with correct password', () => {
      const user = User.register({
        email: makeEmail(),
        name: 'Alice',
        passwordHash: makeHash(),
        now: NOW,
      });
      user.markEmailVerified(NOW);
      for (let i = 0; i < 5; i++) {
        user.tryLogin({ isPasswordCorrect: false, now: NOW });
      }
      const r = user.tryLogin({ isPasswordCorrect: true, now: NOW });
      expect(r.isErr()).toBe(true);
      if (r.isErr()) expect(r.error).toBeInstanceOf(AccountLockedError);
    });

    it('login succeeds again after lockout expires', () => {
      const user = User.register({
        email: makeEmail(),
        name: 'Alice',
        passwordHash: makeHash(),
        now: NOW,
      });
      user.markEmailVerified(NOW);
      for (let i = 0; i < 5; i++) {
        user.tryLogin({ isPasswordCorrect: false, now: NOW });
      }
      const later = new Date(NOW.getTime() + 16 * 60 * 1000); // 16 min después
      const r = user.tryLogin({ isPasswordCorrect: true, now: later });
      expect(r.isOk()).toBe(true);
      expect(user.failedLoginAttempts).toBe(0);
      expect(user.isLocked(later)).toBe(false);
    });
  });

  describe('tryLogin — email not verified', () => {
    it('returns EmailNotVerifiedError when emailVerifiedAt is null', () => {
      const user = User.register({
        email: makeEmail(),
        name: 'Alice',
        passwordHash: makeHash(),
        now: NOW,
      });
      const r = user.tryLogin({ isPasswordCorrect: true, now: NOW });
      expect(r.isErr()).toBe(true);
      if (r.isErr()) expect(r.error).toBeInstanceOf(EmailNotVerifiedError);
    });
  });

  describe('tryLogin — deactivated', () => {
    it('returns AccountDeactivatedError when deletedAt is set', () => {
      const user = User.rehydrate({
        id: User.register({
          email: makeEmail(),
          name: 'Alice',
          passwordHash: makeHash(),
          now: NOW,
        }).id,
        email: makeEmail(),
        name: 'Alice',
        passwordHash: makeHash(),
        emailVerifiedAt: NOW,
        failedLoginAttempts: 0,
        lockedUntil: null,
        isActive: false,
        mustChangePassword: false,
        deletedAt: NOW,
        createdAt: NOW,
        updatedAt: NOW,
      });
      const r = user.tryLogin({ isPasswordCorrect: true, now: NOW });
      expect(r.isErr()).toBe(true);
      if (r.isErr()) expect(r.error).toBeInstanceOf(AccountDeactivatedError);
    });
  });

  describe('markEmailVerified', () => {
    it('sets emailVerifiedAt once', () => {
      const user = User.register({
        email: makeEmail(),
        name: 'Alice',
        passwordHash: makeHash(),
        now: NOW,
      });
      expect(user.isEmailVerified()).toBe(false);
      user.markEmailVerified(NOW);
      expect(user.isEmailVerified()).toBe(true);

      // Idempotente: una segunda llamada no cambia el timestamp
      const after = new Date(NOW.getTime() + 1_000_000);
      user.markEmailVerified(after);
      expect(user.emailVerifiedAt).toEqual(NOW);
    });
  });

  describe('unlock', () => {
    it('clears lockedUntil and resets counter', () => {
      const user = User.register({
        email: makeEmail(),
        name: 'Alice',
        passwordHash: makeHash(),
        now: NOW,
      });
      user.markEmailVerified(NOW);
      for (let i = 0; i < 5; i++) {
        user.tryLogin({ isPasswordCorrect: false, now: NOW });
      }
      expect(user.isLocked(NOW)).toBe(true);
      user.unlock(NOW);
      expect(user.isLocked(NOW)).toBe(false);
      expect(user.failedLoginAttempts).toBe(0);
    });
  });
});
