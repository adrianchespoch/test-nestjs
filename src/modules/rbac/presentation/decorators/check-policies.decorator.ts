import { SetMetadata } from '@nestjs/common';
import type { AppAbility } from '../../infrastructure/casl/app-ability';

export type PolicyHandler = (ability: AppAbility) => boolean;

export const CHECK_POLICIES_KEY = 'check_policies';

/**
 * Atado a un endpoint:
 *
 *   @CheckPolicies((ability) => ability.can('unlock', 'User'))
 *
 * Múltiples handlers se evalúan AND.
 */
export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);
