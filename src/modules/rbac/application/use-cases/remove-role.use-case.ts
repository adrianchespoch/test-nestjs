import { Inject, Injectable } from '@nestjs/common';
import { Result } from '../../../../shared/domain/result';
import { EVENT_BUS, type IEventBus } from '../../../../shared/application/ports/event-bus.port';
import { ROLE_REPOSITORY, type IRoleRepository } from '../../domain/ports/role.repository';
import {
  USER_ROLE_REPOSITORY,
  type IUserRoleRepository,
} from '../../domain/ports/user-role.repository';
import { ABILITY_FACTORY, type IAbilityFactory } from '../../domain/ports/ability-factory.port';
import { RoleNotFoundError } from '../../domain/errors/rbac.errors';
import { RoleRemoved } from '../../domain/events/rbac.events';

export interface RemoveRoleInput {
  userId: string;
  roleName: string;
}

@Injectable()
export class RemoveRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roles: IRoleRepository,
    @Inject(USER_ROLE_REPOSITORY) private readonly userRoles: IUserRoleRepository,
    @Inject(ABILITY_FACTORY) private readonly abilities: IAbilityFactory,
    @Inject(EVENT_BUS) private readonly bus: IEventBus,
  ) {}

  async execute(input: RemoveRoleInput): Promise<Result<{ removed: true }, RoleNotFoundError>> {
    const role = await this.roles.findByName(input.roleName);
    if (!role) return Result.err(new RoleNotFoundError(input.roleName));

    await this.userRoles.remove(input.userId, role.id.value);
    await this.abilities.invalidateForUser(input.userId);

    await this.bus.publish([
      new RoleRemoved(input.userId, {
        userId: input.userId,
        roleId: role.id.value,
        roleName: role.name,
      }),
    ]);

    return Result.ok({ removed: true });
  }
}
