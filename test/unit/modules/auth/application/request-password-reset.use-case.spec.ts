import { RequestPasswordResetUseCase } from '../../../../../src/modules/auth/application/use-cases/request-password-reset.use-case';
import { Email } from '../../../../../src/modules/auth/domain/value-objects/email';
import { HashedPassword } from '../../../../../src/modules/auth/domain/value-objects/password';
import { User } from '../../../../../src/modules/auth/domain/entities/user';
import type { IUserRepository } from '../../../../../src/modules/auth/domain/ports/user.repository';
import type { IOneTimeTokenRepository } from '../../../../../src/modules/auth/domain/ports/one-time-token.repository';
import type { IOneTimeTokenGenerator } from '../../../../../src/modules/auth/domain/ports/one-time-token-generator.port';
import type { IEmailSender } from '../../../../../src/modules/auth/domain/ports/email-sender.port';
import type { IClock } from '../../../../../src/shared/application/ports/clock.port';
import type { ConfigService } from '@nestjs/config';

const NOW = new Date('2026-05-03T10:00:00Z');

const makeUser = (email = 'alice@example.com') => {
  const e = Email.create(email);
  if (e.isErr()) throw e.error;
  return User.register({
    email: e.value,
    name: 'Alice',
    passwordHash: HashedPassword.fromHash('$argon2id$x'),
    now: NOW,
  });
};

const setup = () => {
  const clock: IClock = { now: () => NOW };
  const tokenGen: IOneTimeTokenGenerator = {
    generate: () => ({ raw: 'rawToken', hash: 'hashedToken' }),
    hashOf: (raw: string) => `hash-of-${raw}`,
  };
  const userMap = new Map<string, User>();
  const users: IUserRepository = {
    findById: jest.fn(),
    findByEmail: jest.fn(async (e) => {
      for (const u of userMap.values()) if (u.email.equals(e)) return u;
      return null;
    }),
    emailExists: jest.fn(),
    save: jest.fn(),
  };
  const tokens: IOneTimeTokenRepository = {
    findByHash: jest.fn(),
    save: jest.fn(),
    invalidateAllForUser: jest.fn(),
  };
  const mailer: IEmailSender = { send: jest.fn().mockResolvedValue(undefined) };

  const config = { get: (k: string) => (k === 'APP_URL' ? 'http://x' : null) } as ConfigService;

  const useCase = new RequestPasswordResetUseCase(users, tokens, tokenGen, mailer, clock, config);
  return { useCase, users, tokens, mailer, userMap };
};

describe('RequestPasswordResetUseCase', () => {
  it('returns ok and sends email when user exists', async () => {
    const { useCase, mailer, tokens, userMap } = setup();
    const user = makeUser();
    userMap.set(user.id.value, user);
    const r = await useCase.execute({ email: 'alice@example.com' });
    expect(r.isOk()).toBe(true);
    if (r.isOk()) expect(r.value.accepted).toBe(true);
    expect(tokens.invalidateAllForUser).toHaveBeenCalledWith(user.id.value, 'password-reset', NOW);
    expect(tokens.save).toHaveBeenCalled();
    expect(mailer.send).toHaveBeenCalled();
  });

  it('returns ok WITHOUT sending email when user does not exist (no leak)', async () => {
    const { useCase, mailer, tokens } = setup();
    const r = await useCase.execute({ email: 'ghost@example.com' });
    expect(r.isOk()).toBe(true);
    expect(mailer.send).not.toHaveBeenCalled();
    expect(tokens.save).not.toHaveBeenCalled();
  });

  it('returns ok and sends nothing for malformed email (no leak)', async () => {
    const { useCase, mailer } = setup();
    const r = await useCase.execute({ email: 'not-an-email' });
    expect(r.isOk()).toBe(true);
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('does NOT send email if user is soft-deleted', async () => {
    const { useCase, mailer, userMap } = setup();
    const user = User.rehydrate({
      id: makeUser().id,
      email: Email.fromTrustedString('alice@example.com'),
      name: 'Alice',
      passwordHash: HashedPassword.fromHash('$argon2id$x'),
      emailVerifiedAt: NOW,
      failedLoginAttempts: 0,
      lockedUntil: null,
      isActive: false,
      mustChangePassword: false,
      deletedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    });
    userMap.set(user.id.value, user);

    const r = await useCase.execute({ email: 'alice@example.com' });
    expect(r.isOk()).toBe(true);
    expect(mailer.send).not.toHaveBeenCalled();
  });
});
