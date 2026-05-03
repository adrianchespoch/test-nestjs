import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Result } from '../../../../shared/domain/result';
import { CLOCK, type IClock } from '../../../../shared/application/ports/clock.port';
import { USER_REPOSITORY, type IUserRepository } from '../../domain/ports/user.repository';
import {
  ONE_TIME_TOKEN_REPOSITORY,
  type IOneTimeTokenRepository,
} from '../../domain/ports/one-time-token.repository';
import {
  ONE_TIME_TOKEN_GENERATOR,
  type IOneTimeTokenGenerator,
} from '../../domain/ports/one-time-token-generator.port';
import { EMAIL_SENDER, type IEmailSender } from '../../domain/ports/email-sender.port';
import { Email } from '../../domain/value-objects/email';
import { OneTimeToken, OneTimeTokenId } from '../../domain/entities/one-time-token';

export interface RequestPasswordResetInput {
  email: string;
}

/**
 * No revela si el email existe. Siempre retorna Ok (idempotente desde la perspectiva
 * del cliente). Internamente: si existe el user → emite token + manda email.
 */
@Injectable()
export class RequestPasswordResetUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(ONE_TIME_TOKEN_REPOSITORY) private readonly tokens: IOneTimeTokenRepository,
    @Inject(ONE_TIME_TOKEN_GENERATOR) private readonly tokenGen: IOneTimeTokenGenerator,
    @Inject(EMAIL_SENDER) private readonly mailer: IEmailSender,
    @Inject(CLOCK) private readonly clock: IClock,
    private readonly config: ConfigService,
  ) {}

  async execute(input: RequestPasswordResetInput): Promise<Result<{ accepted: true }, never>> {
    const emailParse = Email.create(input.email);
    if (emailParse.isErr()) return Result.ok({ accepted: true });

    const user = await this.users.findByEmail(emailParse.value);
    if (!user || user.deletedAt !== null) {
      return Result.ok({ accepted: true });
    }

    const now = this.clock.now();
    // Invalidar tokens previos para evitar acumulación.
    await this.tokens.invalidateAllForUser(user.id.value, 'password-reset', now);

    const generated = this.tokenGen.generate();
    const token = OneTimeToken.issue({
      id: OneTimeTokenId.of(randomUUID()),
      hash: generated.hash,
      purpose: 'password-reset',
      userId: user.id.value,
      now,
    });
    await this.tokens.save(token);

    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    const link = `${appUrl}/auth/password-reset?token=${generated.raw}`;
    await this.mailer
      .send({
        to: user.email.value,
        subject: 'Reset your password',
        template: 'password-reset',
        body: `Reset link (valid 30 minutes): ${link}`,
        variables: { link },
      })
      .catch(() => {
        // best-effort
      });

    return Result.ok({ accepted: true });
  }
}
