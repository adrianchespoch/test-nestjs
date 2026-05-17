import { Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiErrorDto } from '../../../../shared/presentation/dtos/api-error.dto';
import { AdminUnlockUserUseCase } from '../../application/use-cases/admin-unlock-user.use-case';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CheckPolicies } from '../../../rbac/presentation/decorators/check-policies.decorator';
import { PoliciesGuard } from '../../../rbac/presentation/guards/policies.guard';

@ApiTags('Admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Falta o inválido el access token.' })
@ApiForbiddenResponse({
  type: ApiErrorDto,
  description: 'Sin permiso `unlock:User` / `manage:User` / `manage:all`.',
})
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly unlockUseCase: AdminUnlockUserUseCase) {}

  @Post('users/:userId/unlock')
  @HttpCode(204)
  @CheckPolicies(
    (a) => a.can('unlock', 'User') || a.can('manage', 'User') || a.can('manage', 'all'),
  )
  @ApiOperation({
    summary: 'Unlock a locked user account',
    description: 'Resetea intentos fallidos y `lockedUntil`. Idempotente.',
  })
  @ApiParam({
    name: 'userId',
    format: 'uuid',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @ApiNoContentResponse({ description: 'Cuenta desbloqueada (o no estaba bloqueada).' })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'User does not exist' })
  async unlock(@Param('userId') userId: string): Promise<void> {
    const r = await this.unlockUseCase.execute({ userId });
    if (r.isErr()) throw r.error;
  }
}
