import { Inject, Injectable } from '@nestjs/common';
import { Result } from '../../../../shared/domain/result';
import { CLOCK, type IClock } from '../../../../shared/application/ports/clock.port';
import { EVENT_BUS, type IEventBus } from '../../../../shared/application/ports/event-bus.port';
import { USER_REPOSITORY, type IUserRepository } from '../../domain/ports/user.repository';
import { HASHER, type IHasher } from '../../domain/ports/hasher.port';
import { Email } from '../../domain/value-objects/email';
import { Password } from '../../domain/value-objects/password';
import { User } from '../../domain/entities/user';
import {
  EmailAlreadyExistsError,
  InvalidEmailError,
  WeakPasswordError,
} from '../../domain/errors/auth.errors';

export interface RegisterUserInput {
  email: string;
  name: string;
  password: string;
}

export interface RegisterUserOutput {
  userId: string;
}

type RegisterUserError = InvalidEmailError | WeakPasswordError | EmailAlreadyExistsError;

@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(HASHER) private readonly hasher: IHasher,
    @Inject(CLOCK) private readonly clock: IClock,
    @Inject(EVENT_BUS) private readonly bus: IEventBus,
  ) {}

  async execute(input: RegisterUserInput): Promise<Result<RegisterUserOutput, RegisterUserError>> {
    const email = Email.create(input.email);
    if (email.isErr()) return Result.err(email.error);

    const password = Password.create(input.password);
    if (password.isErr()) return Result.err(password.error);

    const name = (input.name ?? '').trim();
    if (name.length < 1 || name.length > 120) {
      return Result.err(new InvalidEmailError('Name must be 1..120 chars'));
    }

    if (await this.users.emailExists(email.value)) {
      return Result.err(new EmailAlreadyExistsError());
    }

    const passwordHash = await this.hasher.hash(password.value);
    const user = User.register({
      email: email.value,
      name,
      passwordHash,
      now: this.clock.now(),
    });

    await this.users.save(user);
    await this.bus.publish(user.pullEvents());

    return Result.ok({ userId: user.id.value });
  }
}
