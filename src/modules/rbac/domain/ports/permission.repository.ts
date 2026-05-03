import type { Permission } from '../entities/permission';
import type { PermissionId } from '../value-objects/role-id';
import type { PermissionKey } from '../value-objects/permission-key';

export interface IPermissionRepository {
  findById(id: PermissionId): Promise<Permission | null>;
  findByKey(key: PermissionKey): Promise<Permission | null>;
  findAll(): Promise<Permission[]>;
  /** Permisos efectivos para un usuario (vía sus roles). Ya deduplicados. */
  findEffectiveForUser(userId: string): Promise<Permission[]>;
}

export const PERMISSION_REPOSITORY = Symbol('IPermissionRepository');
