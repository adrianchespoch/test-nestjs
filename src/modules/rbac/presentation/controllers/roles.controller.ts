import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiErrorDto } from '../../../../shared/presentation/dtos/api-error.dto';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CheckPolicies } from '../decorators/check-policies.decorator';
import { PoliciesGuard } from '../guards/policies.guard';
import { AssignRoleUseCase } from '../../application/use-cases/assign-role.use-case';
import { ListPermissionsUseCase } from '../../application/use-cases/list-permissions.use-case';
import { ListRolesUseCase } from '../../application/use-cases/list-roles.use-case';
import { RemoveRoleUseCase } from '../../application/use-cases/remove-role.use-case';
import { AssignRoleDto } from '../dtos/assign-role.dto';
import { PermissionResponseDto } from '../dtos/permission-response.dto';
import { RoleResponseDto } from '../dtos/role-response.dto';

@ApiTags('RBAC')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Falta o es inválido el access token.' })
@ApiForbiddenResponse({
  type: ApiErrorDto,
  description: 'El usuario no tiene el permiso requerido (PoliciesGuard).',
})
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
  @ApiOperation({
    summary: 'List all roles with their permission keys',
    description: 'Requiere permiso `read:Role`. Devuelve roles del sistema y custom.',
  })
  @ApiOkResponse({ type: [RoleResponseDto], description: 'Lista de roles.' })
  async getRoles(): Promise<RoleResponseDto[]> {
    const r = await this.listRoles.execute();
    if (r.isErr()) throw r.error;
    return r.value;
  }

  @Get('permissions')
  @CheckPolicies((a) => a.can('read', 'Permission'))
  @ApiOperation({
    summary: 'List the permission catalog',
    description: 'Requiere permiso `read:Permission`. Catálogo seedeado en `prisma/seed.ts`.',
  })
  @ApiOkResponse({ type: [PermissionResponseDto], description: 'Catálogo de permisos.' })
  async getPermissions(): Promise<PermissionResponseDto[]> {
    const r = await this.listPermissions.execute();
    if (r.isErr()) throw r.error;
    return r.value;
  }

  @Post('users/:userId/roles')
  @HttpCode(204)
  @CheckPolicies((a) => a.can('update', 'User') || a.can('manage', 'all'))
  @ApiOperation({
    summary: 'Assign a role to a user (idempotent)',
    description: 'Requiere `update:User` o `manage:all`. Re-asignar el mismo rol es no-op.',
  })
  @ApiParam({
    name: 'userId',
    format: 'uuid',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @ApiBody({ type: AssignRoleDto })
  @ApiNoContentResponse({ description: 'Rol asignado (o ya estaba asignado).' })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'El rol no existe.' })
  async assign(@Param('userId') userId: string, @Body() dto: AssignRoleDto): Promise<void> {
    const r = await this.assignRole.execute({ userId, roleName: dto.roleName });
    if (r.isErr()) throw r.error;
  }

  @Delete('users/:userId/roles/:roleName')
  @HttpCode(204)
  @CheckPolicies((a) => a.can('update', 'User') || a.can('manage', 'all'))
  @ApiOperation({
    summary: 'Remove a role from a user (idempotent)',
    description: 'Requiere `update:User` o `manage:all`. Quitar un rol no asignado es no-op.',
  })
  @ApiParam({
    name: 'userId',
    format: 'uuid',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @ApiParam({ name: 'roleName', example: 'admin' })
  @ApiNoContentResponse({ description: 'Rol removido (o no estaba asignado).' })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'El rol no existe.' })
  async remove(
    @Param('userId') userId: string,
    @Param('roleName') roleName: string,
  ): Promise<void> {
    const r = await this.removeRole.execute({ userId, roleName });
    if (r.isErr()) throw r.error;
  }
}
