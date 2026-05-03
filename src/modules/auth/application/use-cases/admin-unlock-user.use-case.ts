import { Inject, Injectable } from '@nestjs/common';
import { Result } from '../../../../shared/domain/result';
import { CLOCK, type IClock } from '../../../../shared/application/ports/clock.port';
import { USER_REPOSITORY, type IUserRepository } from '../../domain/ports/user.repository';
import { UserId } from '../../domain/value-objects/user-id';
import { NotFoundDomainError } from '../../../../shared/domain/errors/domain.error';

class UserNotFoundError extends NotFoundDomainError {
  override readonly code = 'USER_NOT_FOUND';
  constructor(id: string) {
    super(`User not found: ${id}`);
  }
}

export interface AdminUnlockUserInput {
  userId: string;
}

@Injectable()
export class AdminUnlockUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(CLOCK) private readonly clock: IClock,
  ) {}

  async execute(
    input: AdminUnlockUserInput,
  ): Promise<Result<{ unlocked: true }, UserNotFoundError>> {
    const id = UserId.fromString(input.userId);
    const user = await this.users.findById(id);
    if (!user) return Result.err(new UserNotFoundError(input.userId));

    user.unlock(this.clock.now());
    await this.users.save(user);
    return Result.ok({ unlocked: true });
  }
}
