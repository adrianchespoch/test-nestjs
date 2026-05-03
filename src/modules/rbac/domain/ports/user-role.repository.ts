export interface IUserRoleRepository {
  /** Asigna el rol al user. Idempotente: si ya está, no falla. */
  assign(userId: string, roleId: string): Promise<void>;
  /** Quita el rol del user. Idempotente. */
  remove(userId: string, roleId: string): Promise<void>;
  /** Roles activos de un usuario (id + name). */
  rolesOfUser(userId: string): Promise<Array<{ id: string; name: string }>>;
}

export const USER_ROLE_REPOSITORY = Symbol('IUserRoleRepository');
