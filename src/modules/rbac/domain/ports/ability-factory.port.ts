import type { AppAbility } from '../../infrastructure/casl/app-ability';

export interface IAbilityFactory {
  /** Construye Ability para el user. Puede usar cache. */
  createForUser(userId: string): Promise<AppAbility>;
  /** Invalida cache (tras cambios en roles/permisos). */
  invalidateForUser(userId: string): Promise<void>;
  invalidateForRole(roleId: string): Promise<void>;
}

export const ABILITY_FACTORY = Symbol('IAbilityFactory');
