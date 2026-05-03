import { Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminUnlockUserUseCase } from '../../application/use-cases/admin-unlock-user.use-case';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CheckPolicies } from '../../../rbac/presentation/decorators/check-policies.decorator';
import { PoliciesGuard } from '../../../rbac/presentation/guards/policies.guard';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly unlockUseCase: AdminUnlockUserUseCase) {}

  @Post('users/:userId/unlock')
  @HttpCode(204)
  @CheckPolicies(
    (a) => a.can('unlock', 'User') || a.can('manage', 'User') || a.can('manage', 'all'),
  )
  @ApiOperation({ summary: 'Unlock a locked user account' })
  @ApiNotFoundResponse({ description: 'User does not exist' })
  @ApiForbiddenResponse()
  async unlock(@Param('userId') userId: string): Promise<void> {
    const r = await this.unlockUseCase.execute({ userId });
    if (r.isErr()) throw r.error;
  }
}
