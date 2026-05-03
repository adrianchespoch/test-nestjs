import { HandleOAuthCallbackUseCase } from '../../../../../src/modules/auth/application/use-cases/handle-oauth-callback.use-case';
import { Email } from '../../../../../src/modules/auth/domain/value-objects/email';
import { HashedPassword } from '../../../../../src/modules/auth/domain/value-objects/password';
import { User } from '../../../../../src/modules/auth/domain/entities/user';
import {
  AccountProvider,
  AccountProviderId,
} from '../../../../../src/modules/auth/domain/entities/account-provider';
import { OAuthProfile } from '../../../../../src/modules/auth/domain/value-objects/oauth-profile';
import type { IUserRepository } from '../../../../../src/modules/auth/domain/ports/user.repository';
import type { IAccountProviderRepository } from '../../../../../src/modules/auth/domain/ports/account-provider.repository';
import type { ISessionRepository } from '../../../../../src/modules/auth/domain/ports/session.repository';
import type { IRefreshTokenRepository } from '../../../../../src/modules/auth/domain/ports/refresh-token.repository';
import type { IJwtSigner } from '../../../../../src/modules/auth/domain/ports/jwt-signer.port';
import type { IRefreshTokenGenerator } from '../../../../../src/modules/auth/domain/ports/refresh-token-generator.port';
import type { IClock } from '../../../../../src/shared/application/ports/clock.port';
import type { IEventBus } from '../../../../../src/shared/application/ports/event-bus.port';
import {
  AccountLinkRequiredError,
  OAuthMissingEmailError,
} from '../../../../../src/modules/auth/domain/errors/auth.errors';

const NOW = new Date('2026-05-03T10:00:00Z');

const profileFor = (
  email: string,
  providerAccountId = 'google-123',
  verified = true,
): OAuthProfile => {
  const e = Email.create(email);
  if (e.isErr()) throw e.error;
  return OAuthProfile.create({
    provider: 'google',
    providerAccountId,
    email: e.value,
    name: 'Alice',
    emailVerifiedByProvider: verified,
  });
};

const setup = () => {
  const clock: IClock = { now: () => NOW };
  const bus: IEventBus = { publish: jest.fn().mockResolvedValue(undefined), subscribe: jest.fn() };

  const userMap = new Map<string, User>();
  const users: IUserRepository = {
    findById: jest.fn(async (id) => userMap.get(id.value) ?? null),
    findByEmail: jest.fn(async (e) => {
      for (const u of userMap.values()) if (u.email.equals(e)) return u;
      return null;
    }),
    emailExists: jest.fn(),
    save: jest.fn(async (u) => {
      userMap.set(u.id.value, u);
    }),
  };

  const links: AccountProvider[] = [];
  const accounts: IAccountProviderRepository = {
    findByProviderAccount: jest.fn(async (provider, providerAccountId) => {
      return (
        links.find((l) => l.provider === provider && l.providerAccountId === providerAccountId) ??
        null
      );
    }),
    findAllForUser: jest.fn(async (userId) => links.filter((l) => l.userId === userId)),
    save: jest.fn(async (l) => {
      links.push(l);
    }),
  };

  const sessions: ISessionRepository = {
    findById: jest.fn(),
    save: jest.fn(),
    revokeAllForUser: jest.fn(),
  };
  const refreshTokens: IRefreshTokenRepository = {
    findById: jest.fn(),
    findByHash: jest.fn(),
    save: jest.fn(),
    revokeFamily: jest.fn(),
    revokeAllForUser: jest.fn(),
  };
  const jwt: IJwtSigner = {
    signAccessToken: jest.fn().mockResolvedValue({ token: 'jwt-token', expiresInSec: 900 }),
    verifyAccessToken: jest.fn(),
  };
  const tokenGen: IRefreshTokenGenerator = {
    generate: () => ({ raw: 'rt-raw', hash: 'rt-hash' }),
    hashOf: (raw: string) => `hash-of-${raw}`,
  };

  const useCase = new HandleOAuthCallbackUseCase(
    users,
    accounts,
    sessions,
    refreshTokens,
    jwt,
    tokenGen,
    clock,
    bus,
  );
  return { useCase, users, accounts, userMap, links, jwt, sessions, refreshTokens };
};

describe('HandleOAuthCallbackUseCase', () => {
  it('creates a new User + AccountProvider when no email/link match (first-time login)', async () => {
    const { useCase, userMap, links } = setup();
    const r = await useCase.execute({
      profile: profileFor('alice@gmail.com'),
      authenticatedUserId: null,
    });
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.created).toBe(true);
      expect(r.value.linked).toBe(false);
      expect(r.value.accessToken).toBe('jwt-token');
    }
    expect(userMap.size).toBe(1);
    expect(links).toHaveLength(1);
    expect([...userMap.values()][0]!.passwordHash).toBeNull();
    expect([...userMap.values()][0]!.isEmailVerified()).toBe(true);
  });

  it('logs in existing user when AccountProvider link already exists', async () => {
    const { useCase, userMap, links } = setup();
    // pre-existing user + link
    const existing = User.registerViaOAuth({
      email: profileFor('alice@gmail.com').email,
      name: 'Alice',
      now: NOW,
    });
    userMap.set(existing.id.value, existing);
    links.push(
      AccountProvider.rehydrate({
        id: AccountProviderId.of('ap-1'),
        userId: existing.id.value,
        provider: 'google',
        providerAccountId: 'google-123',
        createdAt: NOW,
      }),
    );

    const r = await useCase.execute({
      profile: profileFor('alice@gmail.com', 'google-123'),
      authenticatedUserId: null,
    });
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.created).toBe(false);
      expect(r.value.linked).toBe(false);
      expect(r.value.userId).toBe(existing.id.value);
    }
    expect(userMap.size).toBe(1);
  });

  it('returns AccountLinkRequiredError when email exists but caller is not authenticated', async () => {
    const { useCase, userMap } = setup();
    // user con password registrado existe
    const e = Email.create('alice@example.com');
    if (e.isErr()) throw e.error;
    const existing = User.register({
      email: e.value,
      name: 'Alice',
      passwordHash: HashedPassword.fromHash('$argon2id$x'),
      now: NOW,
    });
    userMap.set(existing.id.value, existing);

    const r = await useCase.execute({
      profile: profileFor('alice@example.com'),
      authenticatedUserId: null,
    });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error).toBeInstanceOf(AccountLinkRequiredError);
  });

  it('links provider when authenticated user matches the email', async () => {
    const { useCase, userMap, links } = setup();
    const e = Email.create('alice@example.com');
    if (e.isErr()) throw e.error;
    const existing = User.register({
      email: e.value,
      name: 'Alice',
      passwordHash: HashedPassword.fromHash('$argon2id$x'),
      now: NOW,
    });
    userMap.set(existing.id.value, existing);

    const r = await useCase.execute({
      profile: profileFor('alice@example.com'),
      authenticatedUserId: existing.id.value,
    });
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.linked).toBe(true);
      expect(r.value.created).toBe(false);
      expect(r.value.userId).toBe(existing.id.value);
    }
    expect(links).toHaveLength(1);
  });

  it('returns AccountLinkRequiredError when authenticated user mismatches email', async () => {
    const { useCase, userMap } = setup();
    const aliceEmail = Email.create('alice@example.com');
    const bobEmail = Email.create('bob@example.com');
    if (aliceEmail.isErr() || bobEmail.isErr()) throw new Error('test setup');
    const alice = User.register({
      email: aliceEmail.value,
      name: 'Alice',
      passwordHash: HashedPassword.fromHash('$argon2id$x'),
      now: NOW,
    });
    const bob = User.register({
      email: bobEmail.value,
      name: 'Bob',
      passwordHash: HashedPassword.fromHash('$argon2id$x'),
      now: NOW,
    });
    userMap.set(alice.id.value, alice);
    userMap.set(bob.id.value, bob);

    const r = await useCase.execute({
      profile: profileFor('bob@example.com'),
      authenticatedUserId: alice.id.value,
    });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error).toBeInstanceOf(AccountLinkRequiredError);
  });

  it('rejects unverified emails from the provider', async () => {
    const { useCase } = setup();
    const r = await useCase.execute({
      profile: profileFor('alice@gmail.com', 'google-x', false),
      authenticatedUserId: null,
    });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error).toBeInstanceOf(OAuthMissingEmailError);
  });
});
