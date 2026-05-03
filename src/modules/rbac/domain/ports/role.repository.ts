import type { Role } from '../entities/role';
import type { RoleId } from '../value-objects/role-id';

export interface IRoleRepository {
  findById(id: RoleId): Promise<Role | null>;
  findByName(name: string): Promise<Role | null>;
  findAll(): Promise<Role[]>;
  /** Solo cuenta usuarios asignados (incluye soft-deleted). */
  countAssignedUsers(id: RoleId): Promise<number>;
  save(role: Role): Promise<void>;
  delete(id: RoleId): Promise<void>;
}

export const ROLE_REPOSITORY = Symbol('IRoleRepository');
