import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Result } from '../../../../shared/domain/result';
import { CLOCK, type IClock } from '../../../../shared/application/ports/clock.port';
import { EVENT_BUS, type IEventBus } from '../../../../shared/application/ports/event-bus.port';
import {
  ACCOUNT_PROVIDER_REPOSITORY,
  type IAccountProviderRepository,
} from '../../domain/ports/account-provider.repository';
import { USER_REPOSITORY, type IUserRepository } from '../../domain/ports/user.repository';
import { SESSION_REPOSITORY, type ISessionRepository } from '../../domain/ports/session.repository';
import {
  REFRESH_TOKEN_REPOSITORY,
  type IRefreshTokenRepository,
} from '../../domain/ports/refresh-token.repository';
import { JWT_SIGNER, type IJwtSigner } from '../../domain/ports/jwt-signer.port';
import {
  REFRESH_TOKEN_GENERATOR,
  type IRefreshTokenGenerator,
} from '../../domain/ports/refresh-token-generator.port';
import { AccountProvider } from '../../domain/entities/account-provider';
import { Session } from '../../domain/entities/session';
import { RefreshToken, RefreshTokenId } from '../../domain/entities/refresh-token';
import { User } from '../../domain/entities/user';
import { UserId } from '../../domain/value-objects/user-id';
import type { OAuthProfile } from '../../domain/value-objects/oauth-profile';
import { AccountLinkRequiredError, OAuthMissingEmailError } from '../../domain/errors/auth.errors';
import { OAuthAccountCreated, OAuthAccountLinked } from '../../domain/events/oauth.events';

export interface HandleOAuthCallbackInput {
  profile: OAuthProfile;
  /** UserId si el flow inició desde un usuario autenticado (linking). */
  authenticatedUserId: string | null;
  ip?: string;
  userAgent?: string;
}

export interface HandleOAuthCallbackOutput {
  accessToken: string;
  accessTokenExpiresInSec: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  userId: string;
  sessionId: string;
  /** True si se creó un nuevo user en este flow. */
  created: boolean;
  /** True si se ligó la cuenta a un user existente en este flow. */
  linked: boolean;
}

type CallbackError = AccountLinkRequiredError | OAuthMissingEmailError;

const REFRESH_TTL_SEC = 60 * 60 * 24 * 30;

@Injectable()
export class HandleOAuthCallbackUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(ACCOUNT_PROVIDER_REPOSITORY) private readonly accounts: IAccountProviderRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: ISessionRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: IRefreshTokenRepository,
    @Inject(JWT_SIGNER) private readonly jwt: IJwtSigner,
    @Inject(REFRESH_TOKEN_GENERATOR) private readonly tokenGen: IRefreshTokenGenerator,
    @Inject(CLOCK) private readonly clock: IClock,
    @Inject(EVENT_BUS) private readonly bus: IEventBus,
  ) {}

  async execute(
    input: HandleOAuthCallbackInput,
  ): Promise<Result<HandleOAuthCallbackOutput, CallbackError>> {
    const { profile } = input;
    if (!profile.emailVerifiedByProvider) {
      return Result.err(new OAuthMissingEmailError());
    }

    const now = this.clock.now();

    // 1) Existing link → login
    const existingLink = await this.accounts.findByProviderAccount(
      profile.provider,
      profile.providerAccountId,
    );
    if (existingLink) {
      const linkedUser = await this.users.findById(UserId.fromString(existingLink.userId));
      if (linkedUser && linkedUser.deletedAt === null && linkedUser.isActive) {
        return this.issueSession(linkedUser, input, { created: false, linked: false });
      }
    }

    // 2) Resolve authenticated linker (si viene desde flow de linking)
    let authenticatedUser: User | null = null;
    if (input.authenticatedUserId) {
      authenticatedUser = await this.users.findById(UserId.fromString(input.authenticatedUserId));
    }

    // 3) Match by email
    const userByEmail = await this.users.findByEmail(profile.email);

    // Caso A: el linker autenticado coincide con el email del provider → linkear
    if (authenticatedUser && userByEmail && authenticatedUser.id.equals(userByEmail.id)) {
      const link = AccountProvider.create({
        userId: authenticatedUser.id.value,
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
        now,
      });
      await this.accounts.save(link);
      await this.bus.publish([
        new OAuthAccountLinked(authenticatedUser.id.value, {
          userId: authenticatedUser.id.value,
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
        }),
      ]);
      return this.issueSession(authenticatedUser, input, { created: false, linked: true });
    }

    // Caso B: existe user con ese email pero NO está autenticado → conflict
    if (userByEmail && !authenticatedUser) {
      return Result.err(new AccountLinkRequiredError());
    }

    // Caso C: linker autenticado ≠ email del provider → conflict (no permitimos linkear con email distinto)
    if (authenticatedUser && userByEmail && !authenticatedUser.id.equals(userByEmail.id)) {
      return Result.err(new AccountLinkRequiredError());
    }

    // Caso D: nuevo user — crear y linkear
    const newUser = User.registerViaOAuth({
      email: profile.email,
      name: profile.name,
      now,
    });
    await this.users.save(newUser);
    await this.bus.publish(newUser.pullEvents());

    const link = AccountProvider.create({
      userId: newUser.id.value,
      provider: profile.provider,
      providerAccountId: profile.providerAccountId,
      now,
    });
    await this.accounts.save(link);

    await this.bus.publish([
      new OAuthAccountCreated(newUser.id.value, {
        userId: newUser.id.value,
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
        email: profile.email.value,
      }),
    ]);

    return this.issueSession(newUser, input, { created: true, linked: false });
  }

  private async issueSession(
    user: User,
    input: HandleOAuthCallbackInput,
    flags: { created: boolean; linked: boolean },
  ): Promise<Result<HandleOAuthCallbackOutput, never>> {
    const now = this.clock.now();

    const session = Session.start({
      userId: user.id.value,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      now,
    });
    await this.sessions.save(session);

    const familyId = randomUUID();
    const generated = this.tokenGen.generate();
    const refreshToken = RefreshToken.create({
      id: RefreshTokenId.of(randomUUID()),
      hash: generated.hash,
      familyId,
      parentId: null,
      sessionId: session.id.value,
      userId: user.id.value,
      expiresAt: new Date(now.getTime() + REFRESH_TTL_SEC * 1000),
      revokedAt: null,
      reuseDetectedAt: null,
      createdAt: now,
    });
    await this.refreshTokens.save(refreshToken);

    user.recordSuccessfulSession({
      sessionId: session.id.value,
      ip: input.ip,
      userAgent: input.userAgent,
    });
    await this.bus.publish(user.pullEvents());

    const access = await this.jwt.signAccessToken({
      sub: user.id.value,
      sid: session.id.value,
    });

    return Result.ok({
      accessToken: access.token,
      accessTokenExpiresInSec: access.expiresInSec,
      refreshToken: generated.raw,
      refreshTokenExpiresAt: refreshToken.expiresAt,
      userId: user.id.value,
      sessionId: session.id.value,
      created: flags.created,
      linked: flags.linked,
    });
  }
}
