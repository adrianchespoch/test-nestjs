import { VerifyEmailUseCase } from '../../../../../src/modules/auth/application/use-cases/verify-email.use-case';
import { Email } from '../../../../../src/modules/auth/domain/value-objects/email';
import { HashedPassword } from '../../../../../src/modules/auth/domain/value-objects/password';
import { User } from '../../../../../src/modules/auth/domain/entities/user';
import {
  OneTimeToken,
  OneTimeTokenId,
} from '../../../../../src/modules/auth/domain/entities/one-time-token';
import type { IUserRepository } from '../../../../../src/modules/auth/domain/ports/user.repository';
import type { IOneTimeTokenRepository } from '../../../../../src/modules/auth/domain/ports/one-time-token.repository';
import type { IOneTimeTokenGenerator } from '../../../../../src/modules/auth/domain/ports/one-time-token-generator.port';
import type { IClock } from '../../../../../src/shared/application/ports/clock.port';
import type { IEventBus } from '../../../../../src/shared/application/ports/event-bus.port';
import { VerificationTokenInvalidError } from '../../../../../src/modules/auth/domain/errors/auth.errors';

const NOW = new Date('2026-05-03T10:00:00Z');

const makeUser = () => {
  const e = Email.create('alice@example.com');
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
  const bus: IEventBus = { publish: jest.fn().mockResolvedValue(undefined), subscribe: jest.fn() };

  const tokenGen: IOneTimeTokenGenerator = {
    generate: () => ({ raw: 'raw', hash: 'h' }),
    hashOf: (raw: string) => `hash-of-${raw}`,
  };

  const userMap = new Map<string, User>();
  const users: IUserRepository = {
    findById: jest.fn(async (id) => userMap.get(id.value) ?? null),
    findByEmail: jest.fn(),
    emailExists: jest.fn(),
    save: jest.fn(async (u) => {
      userMap.set(u.id.value, u);
    }),
  };

  const tokenMap = new Map<string, OneTimeToken>();
  const tokens: IOneTimeTokenRepository = {
    findByHash: jest.fn(async (hash) => tokenMap.get(hash) ?? null),
    save: jest.fn(async (t) => {
      tokenMap.set(t.hash, t);
    }),
    invalidateAllForUser: jest.fn(),
  };

  const useCase = new VerifyEmailUseCase(users, tokens, tokenGen, clock, bus);
  return { useCase, users, tokens, userMap, tokenMap };
};

describe('VerifyEmailUseCase', () => {
  it('marks emailVerifiedAt and uses the token', async () => {
    const { useCase, users, tokens, userMap, tokenMap } = setup();
    const user = makeUser();
    userMap.set(user.id.value, user);
    user.pullEvents();

    const token = OneTimeToken.issue({
      id: OneTimeTokenId.of('tk-1'),
      hash: 'hash-of-validToken',
      purpose: 'email-verification',
      userId: user.id.value,
      now: NOW,
    });
    tokenMap.set(token.hash, token);

    const r = await useCase.execute({ rawToken: 'validToken' });
    expect(r.isOk()).toBe(true);
    expect(users.save).toHaveBeenCalled();
    expect(tokens.save).toHaveBeenCalled();
    const after = userMap.get(user.id.value)!;
    expect(after.isEmailVerified()).toBe(true);
    const tokenAfter = tokenMap.get('hash-of-validToken')!;
    expect(tokenAfter.isUsed()).toBe(true);
  });

  it('rejects expired token', async () => {
    const { useCase, tokenMap } = setup();
    const user = makeUser();
    const earlier = new Date(NOW.getTime() - 25 * 60 * 60 * 1000); // 25h atrás
    const token = OneTimeToken.issue({
      id: OneTimeTokenId.of('tk-1'),
      hash: 'hash-of-validToken',
      purpose: 'email-verification',
      userId: user.id.value,
      now: earlier,
    });
    tokenMap.set(token.hash, token);

    const r = await useCase.execute({ rawToken: 'validToken' });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error).toBeInstanceOf(VerificationTokenInvalidError);
  });

  it('rejects unknown token', async () => {
    const { useCase } = setup();
    const r = await useCase.execute({ rawToken: 'anything' });
    expect(r.isErr()).toBe(true);
  });

  it('rejects empty input', async () => {
    const { useCase } = setup();
    const r = await useCase.execute({ rawToken: '' });
    expect(r.isErr()).toBe(true);
  });

  it('rejects token with wrong purpose', async () => {
    const { useCase, tokenMap } = setup();
    const user = makeUser();
    const token = OneTimeToken.issue({
      id: OneTimeTokenId.of('tk-1'),
      hash: 'hash-of-validToken',
      purpose: 'password-reset',
      userId: user.id.value,
      now: NOW,
    });
    tokenMap.set(token.hash, token);

    const r = await useCase.execute({ rawToken: 'validToken' });
    expect(r.isErr()).toBe(true);
  });
});
