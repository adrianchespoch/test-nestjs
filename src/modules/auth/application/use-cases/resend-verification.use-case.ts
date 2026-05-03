import { Inject, Injectable } from '@nestjs/common';
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
import { ConfigService } from '@nestjs/config';

export interface ResendVerificationInput {
  email: string;
}

/** Respuesta genérica para evitar email enumeration. */
@Injectable()
export class ResendVerificationUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(ONE_TIME_TOKEN_REPOSITORY) private readonly tokens: IOneTimeTokenRepository,
    @Inject(ONE_TIME_TOKEN_GENERATOR) private readonly tokenGen: IOneTimeTokenGenerator,
    @Inject(EMAIL_SENDER) private readonly mailer: IEmailSender,
    @Inject(CLOCK) private readonly clock: IClock,
    private readonly config: ConfigService,
  ) {}

  async execute(input: ResendVerificationInput): Promise<Result<{ accepted: true }, never>> {
    const emailParse = Email.create(input.email);
    if (emailParse.isErr()) return Result.ok({ accepted: true });

    const user = await this.users.findByEmail(emailParse.value);
    if (!user || user.isEmailVerified() || user.deletedAt !== null) {
      return Result.ok({ accepted: true });
    }

    const now = this.clock.now();
    await this.tokens.invalidateAllForUser(user.id.value, 'email-verification', now);

    const generated = this.tokenGen.generate();
    const token = OneTimeToken.issue({
      id: OneTimeTokenId.of(randomUUID()),
      hash: generated.hash,
      purpose: 'email-verification',
      userId: user.id.value,
      now,
    });
    await this.tokens.save(token);

    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    await this.mailer.send({
      to: user.email.value,
      subject: 'Verify your email',
      template: 'verify-email',
      body: `Click to verify: ${appUrl}/api/auth/email/verify?token=${generated.raw}`,
      variables: { link: `${appUrl}/api/auth/email/verify?token=${generated.raw}` },
    });

    return Result.ok({ accepted: true });
  }
}
