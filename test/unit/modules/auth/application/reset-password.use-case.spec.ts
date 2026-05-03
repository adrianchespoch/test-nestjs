import { ResetPasswordUseCase } from '../../../../../src/modules/auth/application/use-cases/reset-password.use-case';
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
import type { IHasher } from '../../../../../src/modules/auth/domain/ports/hasher.port';
import type { IRefreshTokenRepository } from '../../../../../src/modules/auth/domain/ports/refresh-token.repository';
import type { ISessionRepository } from '../../../../../src/modules/auth/domain/ports/session.repository';
import type { IClock } from '../../../../../src/shared/application/ports/clock.port';
import type { IEventBus } from '../../../../../src/shared/application/ports/event-bus.port';
import {
  ResetTokenInvalidError,
  WeakPasswordError,
} from '../../../../../src/modules/auth/domain/errors/auth.errors';

const NOW = new Date('2026-05-03T10:00:00Z');

const makeUser = () => {
  const e = Email.create('alice@example.com');
  if (e.isErr()) throw e.error;
  return User.register({
    email: e.value,
    name: 'Alice',
    passwordHash: HashedPassword.fromHash('$argon2id$old'),
    now: NOW,
  });
};

const setup = () => {
  const clock: IClock = { now: () => NOW };
  const bus: IEventBus = { publish: jest.fn().mockResolvedValue(undefined), subscribe: jest.fn() };

  const tokenGen: IOneTimeTokenGenerator = {
    generate: () => ({ raw: 'r', hash: 'h' }),
    hashOf: (raw: string) => `hash-of-${raw}`,
  };

  const hasher: IHasher = {
    hash: jest.fn(async () => HashedPassword.fromHash('$argon2id$new')),
    verify: jest.fn(async () => true),
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

  const refreshTokens: IRefreshTokenRepository = {
    findById: jest.fn(),
    findByHash: jest.fn(),
    save: jest.fn(),
    revokeFamily: jest.fn(),
    revokeAllForUser: jest.fn(),
  };

  const sessions: ISessionRepository = {
    findById: jest.fn(),
    save: jest.fn(),
    revokeAllForUser: jest.fn(),
  };

  const useCase = new ResetPasswordUseCase(
    users,
    tokens,
    tokenGen,
    hasher,
    refreshTokens,
    sessions,
    clock,
    bus,
  );
  return { useCase, users, tokens, hasher, refreshTokens, sessions, userMap, tokenMap };
};

describe('ResetPasswordUseCase', () => {
  it('updates password hash and revokes all sessions + refresh tokens', async () => {
    const { useCase, hasher, refreshTokens, sessions, userMap, tokenMap } = setup();
    const user = makeUser();
    userMap.set(user.id.value, user);

    const token = OneTimeToken.issue({
      id: OneTimeTokenId.of('tk-1'),
      hash: 'hash-of-validToken',
      purpose: 'password-reset',
      userId: user.id.value,
      now: NOW,
    });
    tokenMap.set(token.hash, token);

    const r = await useCase.execute({
      rawToken: 'validToken',
      newPassword: 'NewStr0ng!2026',
    });

    expect(r.isOk()).toBe(true);
    expect(hasher.hash).toHaveBeenCalled();
    expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith(user.id.value, NOW);
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith(user.id.value, NOW);
    expect(tokenMap.get('hash-of-validToken')!.isUsed()).toBe(true);
    expect(userMap.get(user.id.value)!.passwordHash?.value).toBe('$argon2id$new');
  });

  it('rejects when new password too weak', async () => {
    const { useCase } = setup();
    const r = await useCase.execute({ rawToken: 'tk', newPassword: 'short' });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error).toBeInstanceOf(WeakPasswordError);
  });

  it('rejects when token unknown', async () => {
    const { useCase } = setup();
    const r = await useCase.execute({
      rawToken: 'unknownToken',
      newPassword: 'NewStr0ng!2026',
    });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error).toBeInstanceOf(ResetTokenInvalidError);
  });

  it('rejects when token has wrong purpose', async () => {
    const { useCase, tokenMap } = setup();
    const user = makeUser();
    const wrong = OneTimeToken.issue({
      id: OneTimeTokenId.of('tk-1'),
      hash: 'hash-of-validToken',
      purpose: 'email-verification',
      userId: user.id.value,
      now: NOW,
    });
    tokenMap.set(wrong.hash, wrong);
    const r = await useCase.execute({
      rawToken: 'validToken',
      newPassword: 'NewStr0ng!2026',
    });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error).toBeInstanceOf(ResetTokenInvalidError);
  });

  it('rejects when token already used', async () => {
    const { useCase, userMap, tokenMap } = setup();
    const user = makeUser();
    userMap.set(user.id.value, user);
    const token = OneTimeToken.issue({
      id: OneTimeTokenId.of('tk-1'),
      hash: 'hash-of-validToken',
      purpose: 'password-reset',
      userId: user.id.value,
      now: NOW,
    });
    token.markUsed(NOW);
    tokenMap.set(token.hash, token);

    const r = await useCase.execute({
      rawToken: 'validToken',
      newPassword: 'NewStr0ng!2026',
    });
    expect(r.isErr()).toBe(true);
  });
});
