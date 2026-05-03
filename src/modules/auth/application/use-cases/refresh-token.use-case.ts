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
import { JWT_SIGNER, type IJwtSigner } from '../../domain/ports/jwt-signer.port';
import { RefreshToken, RefreshTokenId } from '../../domain/entities/refresh-token';
import { randomUUID } from 'node:crypto';
import { InvalidTokenError, TokenReuseDetectedError } from '../../domain/errors/auth.errors';
import { RefreshTokenReuseDetected, RefreshTokenRotated } from '../../domain/events/auth.events';

export interface RefreshTokenInput {
  rawRefreshToken: string;
}

export interface RefreshTokenOutput {
  accessToken: string;
  accessTokenExpiresInSec: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  sessionId: string;
}

type RefreshError = InvalidTokenError | TokenReuseDetectedError;

const REFRESH_TTL_SEC = 60 * 60 * 24 * 30;

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: IRefreshTokenRepository,
    @Inject(REFRESH_TOKEN_GENERATOR) private readonly tokenGen: IRefreshTokenGenerator,
    @Inject(JWT_SIGNER) private readonly jwt: IJwtSigner,
    @Inject(CLOCK) private readonly clock: IClock,
    @Inject(EVENT_BUS) private readonly bus: IEventBus,
  ) {}

  async execute(input: RefreshTokenInput): Promise<Result<RefreshTokenOutput, RefreshError>> {
    const now = this.clock.now();

    if (typeof input.rawRefreshToken !== 'string' || input.rawRefreshToken.length === 0) {
      return Result.err(new InvalidTokenError());
    }

    const hash = this.tokenGen.hashOf(input.rawRefreshToken);
    const existing = await this.refreshTokens.findByHash(hash);

    if (!existing) return Result.err(new InvalidTokenError());

    // Theft detection: token revocado pero todavía circulando.
    if (existing.isRevoked()) {
      existing.flagReuse(now);
      await this.refreshTokens.save(existing);
      await this.refreshTokens.revokeFamily(existing.familyId, now);
      await this.bus.publish([
        new RefreshTokenReuseDetected(existing.userId, {
          familyId: existing.familyId,
          reusedTokenId: existing.id.value,
        }),
      ]);
      return Result.err(new TokenReuseDetectedError());
    }

    if (existing.isExpired(now)) {
      return Result.err(new InvalidTokenError());
    }

    // Rotación: marcar viejo como revocado, emitir nuevo en la misma familia.
    existing.revoke(now);
    await this.refreshTokens.save(existing);

    const generated = this.tokenGen.generate();
    const newToken = RefreshToken.create({
      id: RefreshTokenId.of(randomUUID()),
      hash: generated.hash,
      familyId: existing.familyId,
      parentId: existing.id.value,
      sessionId: existing.sessionId,
      userId: existing.userId,
      expiresAt: new Date(now.getTime() + REFRESH_TTL_SEC * 1000),
      revokedAt: null,
      reuseDetectedAt: null,
      createdAt: now,
    });
    await this.refreshTokens.save(newToken);

    await this.bus.publish([
      new RefreshTokenRotated(existing.userId, {
        familyId: existing.familyId,
        oldTokenId: existing.id.value,
        newTokenId: newToken.id.value,
      }),
    ]);

    const access = await this.jwt.signAccessToken({
      sub: existing.userId,
      sid: existing.sessionId,
    });

    return Result.ok({
      accessToken: access.token,
      accessTokenExpiresInSec: access.expiresInSec,
      refreshToken: generated.raw,
      refreshTokenExpiresAt: newToken.expiresAt,
      sessionId: existing.sessionId,
    });
  }
}
