import { Inject, Injectable } from '@nestjs/common';
import { Result } from '../../../../shared/domain/result';
import { CLOCK, type IClock } from '../../../../shared/application/ports/clock.port';
import { EVENT_BUS, type IEventBus } from '../../../../shared/application/ports/event-bus.port';
import { USER_REPOSITORY, type IUserRepository } from '../../domain/ports/user.repository';
import { HASHER, type IHasher } from '../../domain/ports/hasher.port';
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
import { Email } from '../../domain/value-objects/email';
import { Session } from '../../domain/entities/session';
import { RefreshToken, RefreshTokenId } from '../../domain/entities/refresh-token';
import { randomUUID } from 'node:crypto';
import {
  AccountDeactivatedError,
  AccountLockedError,
  EmailNotVerifiedError,
  InvalidCredentialsError,
} from '../../domain/errors/auth.errors';

export interface LoginInput {
  email: string;
  password: string;
  ip?: string;
  userAgent?: string;
}

export interface LoginOutput {
  accessToken: string;
  accessTokenExpiresInSec: number;
  refreshToken: string; // raw — el caller lo pone en cookie HttpOnly
  refreshTokenExpiresAt: Date;
  userId: string;
  sessionId: string;
}

type LoginError =
  | InvalidCredentialsError
  | AccountLockedError
  | EmailNotVerifiedError
  | AccountDeactivatedError;

const REFRESH_TTL_SEC = 60 * 60 * 24 * 30; // 30 días

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: ISessionRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: IRefreshTokenRepository,
    @Inject(HASHER) private readonly hasher: IHasher,
    @Inject(JWT_SIGNER) private readonly jwt: IJwtSigner,
    @Inject(REFRESH_TOKEN_GENERATOR) private readonly tokenGen: IRefreshTokenGenerator,
    @Inject(CLOCK) private readonly clock: IClock,
    @Inject(EVENT_BUS) private readonly bus: IEventBus,
  ) {}

  async execute(input: LoginInput): Promise<Result<LoginOutput, LoginError>> {
    const now = this.clock.now();

    // Email parsing failure → mensaje genérico (sin leak)
    const emailParse = Email.create(input.email);
    if (emailParse.isErr()) {
      return Result.err(new InvalidCredentialsError());
    }

    const user = await this.users.findByEmail(emailParse.value);

    // Verificación constant-time: si user no existe, hashear de todas formas para
    // que el tiempo de respuesta sea comparable.
    let isPasswordCorrect = false;
    if (user && user.passwordHash) {
      isPasswordCorrect = await this.hasher.verify(user.passwordHash, input.password);
    } else {
      // dummy hash para igualar tiempo
      await this.hasher
        .verify(
          { value: '$argon2id$v=19$m=65536,t=3,p=1$placeholder$placeholder' } as never,
          input.password,
        )
        .catch(() => false);
    }

    if (!user) {
      return Result.err(new InvalidCredentialsError());
    }

    const result = user.tryLogin({ isPasswordCorrect, now });

    // Persistir cambios al user (failed counters / lockout) incluso si falla
    await this.users.save(user);
    await this.bus.publish(user.pullEvents());

    if (result.isErr()) return result;

    // Login OK → crear session + primer refresh
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
    });
  }
}
