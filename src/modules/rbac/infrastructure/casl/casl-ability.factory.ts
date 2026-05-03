import { Inject, Injectable, Logger } from '@nestjs/common';
import { createMongoAbility } from '@casl/ability';
import {
  PERMISSION_REPOSITORY,
  type IPermissionRepository,
} from '../../domain/ports/permission.repository';
import type { IAbilityFactory } from '../../domain/ports/ability-factory.port';
import { type AppAbility, buildAbility } from './app-ability';
import { AbilityCacheStore } from './ability-cache.store';

/**
 * AbilityFactory con cache two-tier (L1 LRU + L2 Redis) e invalidación cross-pod
 * vía pub/sub. Ver `AbilityCacheStore` para el detalle.
 */
@Injectable()
export class CaslAbilityFactory implements IAbilityFactory {
  private readonly logger = new Logger(CaslAbilityFactory.name);

  constructor(
    @Inject(PERMISSION_REPOSITORY) private readonly permissions: IPermissionRepository,
    private readonly cache: AbilityCacheStore,
  ) {}

  async createForUser(userId: string): Promise<AppAbility> {
    // L1
    const local = this.cache.getLocal(userId);
    if (local) return local;

    // L2
    const remoteRules = await this.cache.getRemote(userId);
    if (remoteRules) {
      const ability = createMongoAbility(remoteRules) as AppAbility;
      this.cache.setLocal(userId, ability);
      return ability;
    }

    // Miss → build desde DB
    const permissions = await this.permissions.findEffectiveForUser(userId);
    const ability = buildAbility(permissions, { user: { id: userId } });
    await this.cache.setRemote(userId, ability.rules);
    this.cache.setLocal(userId, ability);
    return ability;
  }

  /**
   * v1: invalidación global (cualquier cambio bumpea el gen counter para todos).
   * Más granular requiere reverse index userId↔roleId — diferido.
   */
  async invalidateForUser(userId: string): Promise<void> {
    this.logger.debug({ userId }, 'ability_invalidate_user');
    await this.cache.publishInvalidation();
  }

  async invalidateForRole(roleId: string): Promise<void> {
    this.logger.debug({ roleId }, 'ability_invalidate_role');
    await this.cache.publishInvalidation();
  }
}
