import { Inject, Injectable } from '@nestjs/common';
import { Result } from '../../../../shared/domain/result';
import { CLOCK, type IClock } from '../../../../shared/application/ports/clock.port';
import { EVENT_BUS, type IEventBus } from '../../../../shared/application/ports/event-bus.port';
import {
  REFRESH_TOKEN_REPOSITORY,
  type IRefreshTokenRepository,
} from '../../domain/ports/refresh-token.repository';
import {
  REFRESH_TOKEN_GENERATOR,
  type IRefreshTokenGenerator,
} from '../../domain/ports/refresh-token-generator.port';
import { SESSION_REPOSITORY, type ISessionRepository } from '../../domain/ports/session.repository';
import { SessionId } from '../../domain/entities/session';
import { UserLoggedOut } from '../../domain/events/auth.events';

export interface LogoutInput {
  rawRefreshToken?: string;
}

export interface LogoutOutput {
  revoked: boolean;
}

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: IRefreshTokenRepository,
    @Inject(REFRESH_TOKEN_GENERATOR) private readonly tokenGen: IRefreshTokenGenerator,
    @Inject(SESSION_REPOSITORY) private readonly sessions: ISessionRepository,
    @Inject(CLOCK) private readonly clock: IClock,
    @Inject(EVENT_BUS) private readonly bus: IEventBus,
  ) {}

  /**
   * Logout es idempotente: si no hay token, retorna 204 igual.
   * Revoca el refresh actual y la sesión asociada (no toda la familia — el rotation
   * ya garantiza que solo este token está activo).
   */
  async execute(input: LogoutInput): Promise<Result<LogoutOutput, never>> {
    if (!input.rawRefreshToken) return Result.ok({ revoked: false });

    const hash = this.tokenGen.hashOf(input.rawRefreshToken);
    const token = await this.refreshTokens.findByHash(hash);

    if (!token || token.isRevoked()) return Result.ok({ revoked: false });

    const now = this.clock.now();
    token.revoke(now);
    await this.refreshTokens.save(token);

    const session = await this.sessions.findById(SessionId.of(token.sessionId));
    if (session && !session.isRevoked()) {
      session.revoke(now);
      await this.sessions.save(session);
    }

    await this.bus.publish([new UserLoggedOut(token.userId, { sessionId: token.sessionId })]);
    return Result.ok({ revoked: true });
  }
}
