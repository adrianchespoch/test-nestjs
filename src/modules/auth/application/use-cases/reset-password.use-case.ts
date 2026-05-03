import { Inject, Injectable } from '@nestjs/common';
import { Result } from '../../../../shared/domain/result';
import { CLOCK, type IClock } from '../../../../shared/application/ports/clock.port';
import { EVENT_BUS, type IEventBus } from '../../../../shared/application/ports/event-bus.port';
import { USER_REPOSITORY, type IUserRepository } from '../../domain/ports/user.repository';
import {
  ONE_TIME_TOKEN_REPOSITORY,
  type IOneTimeTokenRepository,
} from '../../domain/ports/one-time-token.repository';
import {
  ONE_TIME_TOKEN_GENERATOR,
  type IOneTimeTokenGenerator,
} from '../../domain/ports/one-time-token-generator.port';
import { HASHER, type IHasher } from '../../domain/ports/hasher.port';
import {
  REFRESH_TOKEN_REPOSITORY,
  type IRefreshTokenRepository,
} from '../../domain/ports/refresh-token.repository';
import { SESSION_REPOSITORY, type ISessionRepository } from '../../domain/ports/session.repository';
import { Password } from '../../domain/value-objects/password';
import { UserId } from '../../domain/value-objects/user-id';
import { ResetTokenInvalidError, WeakPasswordError } from '../../domain/errors/auth.errors';

export interface ResetPasswordInput {
  rawToken: string;
  newPassword: string;
}

type ResetPasswordError = ResetTokenInvalidError | WeakPasswordError;

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(ONE_TIME_TOKEN_REPOSITORY) private readonly tokens: IOneTimeTokenRepository,
    @Inject(ONE_TIME_TOKEN_GENERATOR) private readonly tokenGen: IOneTimeTokenGenerator,
    @Inject(HASHER) private readonly hasher: IHasher,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: IRefreshTokenRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: ISessionRepository,
    @Inject(CLOCK) private readonly clock: IClock,
    @Inject(EVENT_BUS) private readonly bus: IEventBus,
  ) {}

  async execute(
    input: ResetPasswordInput,
  ): Promise<Result<{ userId: string }, ResetPasswordError>> {
    if (typeof input.rawToken !== 'string' || input.rawToken.length === 0) {
      return Result.err(new ResetTokenInvalidError());
    }

    const newPassword = Password.create(input.newPassword);
    if (newPassword.isErr()) return Result.err(newPassword.error);

    const now = this.clock.now();
    const hash = this.tokenGen.hashOf(input.rawToken);
    const token = await this.tokens.findByHash(hash);

    if (!token || token.purpose !== 'password-reset' || !token.isValid(now)) {
      return Result.err(new ResetTokenInvalidError());
    }

    const user = await this.users.findById(UserId.fromString(token.userId));
    if (!user) return Result.err(new ResetTokenInvalidError());

    const newHash = await this.hasher.hash(newPassword.value);
    user.changePassword(newHash, now);
    user.unlock(now);
    // Si el reset llega antes de email-verify, lo damos por verificado tácitamente
    // — el flujo asume que el dueño del email completó el paso.
    user.markEmailVerified(now);
    await this.users.save(user);

    token.markUsed(now);
    await this.tokens.save(token);

    // Invalidar todas las sesiones + refresh tokens (forzar re-login en todos los devices).
    await this.refreshTokens.revokeAllForUser(user.id.value, now);
    await this.sessions.revokeAllForUser(user.id.value, now);

    await this.bus.publish(user.pullEvents());
    return Result.ok({ userId: user.id.value });
  }
}
