import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CheckPolicies } from '../decorators/check-policies.decorator';
import { PoliciesGuard } from '../guards/policies.guard';
import { AssignRoleUseCase } from '../../application/use-cases/assign-role.use-case';
import { ListPermissionsUseCase } from '../../application/use-cases/list-permissions.use-case';
import { ListRolesUseCase } from '../../application/use-cases/list-roles.use-case';
import { RemoveRoleUseCase } from '../../application/use-cases/remove-role.use-case';
import { AssignRoleDto } from '../dtos/assign-role.dto';

@ApiTags('RBAC')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller('rbac')
export class RolesController {
  constructor(
    private readonly assignRole: AssignRoleUseCase,
    private readonly removeRole: RemoveRoleUseCase,
    private readonly listRoles: ListRolesUseCase,
    private readonly listPermissions: ListPermissionsUseCase,
  ) {}

  @Get('roles')
  @CheckPolicies((a) => a.can('read', 'Role'))
  @ApiOperation({ summary: 'List all roles with their permission keys' })
  @ApiOkResponse()
  @ApiForbiddenResponse()
  async getRoles() {
    const r = await this.listRoles.execute();
    if (r.isErr()) throw r.error;
    return r.value;
  }

  @Get('permissions')
  @CheckPolicies((a) => a.can('read', 'Permission'))
  @ApiOperation({ summary: 'List the permission catalog' })
  @ApiOkResponse()
  @ApiForbiddenResponse()
  async getPermissions() {
    const r = await this.listPermissions.execute();
    if (r.isErr()) throw r.error;
    return r.value;
  }

  @Post('users/:userId/roles')
  @HttpCode(204)
  @CheckPolicies((a) => a.can('update', 'User') || a.can('manage', 'all'))
  @ApiOperation({ summary: 'Assign a role to a user (idempotent)' })
  @ApiNotFoundResponse({ description: 'Role does not exist' })
  @ApiForbiddenResponse()
  async assign(@Param('userId') userId: string, @Body() dto: AssignRoleDto): Promise<void> {
    const r = await this.assignRole.execute({ userId, roleName: dto.roleName });
    if (r.isErr()) throw r.error;
  }

  @Delete('users/:userId/roles/:roleName')
  @HttpCode(204)
  @CheckPolicies((a) => a.can('update', 'User') || a.can('manage', 'all'))
  @ApiOperation({ summary: 'Remove a role from a user (idempotent)' })
  @ApiNotFoundResponse({ description: 'Role does not exist' })
  @ApiForbiddenResponse()
  async remove(
    @Param('userId') userId: string,
    @Param('roleName') roleName: string,
  ): Promise<void> {
    const r = await this.removeRole.execute({ userId, roleName });
    if (r.isErr()) throw r.error;
  }
}
