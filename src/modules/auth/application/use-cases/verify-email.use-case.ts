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
import { UserId } from '../../domain/value-objects/user-id';
import { VerificationTokenInvalidError } from '../../domain/errors/auth.errors';

export interface VerifyEmailInput {
  rawToken: string;
}

@Injectable()
export class VerifyEmailUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(ONE_TIME_TOKEN_REPOSITORY) private readonly tokens: IOneTimeTokenRepository,
    @Inject(ONE_TIME_TOKEN_GENERATOR) private readonly tokenGen: IOneTimeTokenGenerator,
    @Inject(CLOCK) private readonly clock: IClock,
    @Inject(EVENT_BUS) private readonly bus: IEventBus,
  ) {}

  async execute(
    input: VerifyEmailInput,
  ): Promise<Result<{ userId: string }, VerificationTokenInvalidError>> {
    if (typeof input.rawToken !== 'string' || input.rawToken.length === 0) {
      return Result.err(new VerificationTokenInvalidError());
    }
    const now = this.clock.now();
    const hash = this.tokenGen.hashOf(input.rawToken);
    const token = await this.tokens.findByHash(hash);

    if (!token || token.purpose !== 'email-verification' || !token.isValid(now)) {
      return Result.err(new VerificationTokenInvalidError());
    }

    const user = await this.users.findById(UserId.fromString(token.userId));
    if (!user) return Result.err(new VerificationTokenInvalidError());

    user.markEmailVerified(now);
    await this.users.save(user);

    token.markUsed(now);
    await this.tokens.save(token);

    await this.bus.publish(user.pullEvents());

    return Result.ok({ userId: user.id.value });
  }
}
