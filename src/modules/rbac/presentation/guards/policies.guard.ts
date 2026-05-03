import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ABILITY_FACTORY, type IAbilityFactory } from '../../domain/ports/ability-factory.port';
import { CHECK_POLICIES_KEY, type PolicyHandler } from '../decorators/check-policies.decorator';

/**
 * Evalúa los policy handlers declarados con `@CheckPolicies(...)`.
 * Requiere que un guard previo (JwtAuthGuard) haya populado `req.user.userId`.
 *
 * Uso:
 *   @UseGuards(JwtAuthGuard, PoliciesGuard)
 *   @CheckPolicies((a) => a.can('unlock', 'User'))
 */
@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ABILITY_FACTORY) private readonly abilityFactory: IAbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handlers =
      this.reflector.getAllAndOverride<PolicyHandler[] | undefined>(CHECK_POLICIES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (handlers.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user?: { userId?: string } }>();
    const userId = req.user?.userId;
    if (!userId) throw new ForbiddenException({ code: 'FORBIDDEN' });

    const ability = await this.abilityFactory.createForUser(userId);
    const allowed = handlers.every((h) => h(ability));
    if (!allowed) throw new ForbiddenException({ code: 'FORBIDDEN' });
    return true;
  }
}
