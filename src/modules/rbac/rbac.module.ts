import { Module } from '@nestjs/common';

import { AssignRoleUseCase } from './application/use-cases/assign-role.use-case';
import { ListPermissionsUseCase } from './application/use-cases/list-permissions.use-case';
import { ListRolesUseCase } from './application/use-cases/list-roles.use-case';
import { RemoveRoleUseCase } from './application/use-cases/remove-role.use-case';

import { ABILITY_FACTORY } from './domain/ports/ability-factory.port';
import { PERMISSION_REPOSITORY } from './domain/ports/permission.repository';
import { ROLE_REPOSITORY } from './domain/ports/role.repository';
import { USER_ROLE_REPOSITORY } from './domain/ports/user-role.repository';

import { AbilityCacheStore } from './infrastructure/casl/ability-cache.store';
import { CaslAbilityFactory } from './infrastructure/casl/casl-ability.factory';
import { PrismaPermissionRepository } from './infrastructure/persistence/prisma-permission.repository';
import { PrismaRoleRepository } from './infrastructure/persistence/prisma-role.repository';
import { PrismaUserRoleRepository } from './infrastructure/persistence/prisma-user-role.repository';

import { PoliciesGuard } from './presentation/guards/policies.guard';
import { RolesController } from './presentation/controllers/roles.controller';

@Module({
  controllers: [RolesController],
  providers: [
    // Use cases
    AssignRoleUseCase,
    RemoveRoleUseCase,
    ListRolesUseCase,
    ListPermissionsUseCase,

    // Adapters concretos
    PrismaRoleRepository,
    PrismaPermissionRepository,
    PrismaUserRoleRepository,
    AbilityCacheStore,
    CaslAbilityFactory,

    // Bindings port → adapter
    { provide: ROLE_REPOSITORY, useExisting: PrismaRoleRepository },
    { provide: PERMISSION_REPOSITORY, useExisting: PrismaPermissionRepository },
    { provide: USER_ROLE_REPOSITORY, useExisting: PrismaUserRoleRepository },
    { provide: ABILITY_FACTORY, useExisting: CaslAbilityFactory },

    PoliciesGuard,
  ],
  exports: [PoliciesGuard, ABILITY_FACTORY],
})
export class RbacModule {}
