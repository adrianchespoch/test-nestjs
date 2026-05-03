import { AssignRoleUseCase } from '../../../../../src/modules/rbac/application/use-cases/assign-role.use-case';
import { Role } from '../../../../../src/modules/rbac/domain/entities/role';
import type { IAbilityFactory } from '../../../../../src/modules/rbac/domain/ports/ability-factory.port';
import type { IRoleRepository } from '../../../../../src/modules/rbac/domain/ports/role.repository';
import type { IUserRoleRepository } from '../../../../../src/modules/rbac/domain/ports/user-role.repository';
import type { IEventBus } from '../../../../../src/shared/application/ports/event-bus.port';
import { RoleNotFoundError } from '../../../../../src/modules/rbac/domain/errors/rbac.errors';

const NOW = new Date('2026-05-03T10:00:00Z');

const setup = () => {
  const adminRole = Role.create({
    name: 'admin',
    description: null,
    isSystem: false,
    now: NOW,
    permissions: [],
  });

  const roles: IRoleRepository = {
    findById: jest.fn(),
    findByName: jest.fn(async (name) => (name === 'admin' ? adminRole : null)),
    findAll: jest.fn(),
    countAssignedUsers: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const userRoles: IUserRoleRepository = {
    assign: jest.fn(),
    remove: jest.fn(),
    rolesOfUser: jest.fn(),
  };
  const abilities: IAbilityFactory = {
    createForUser: jest.fn(),
    invalidateForUser: jest.fn(),
    invalidateForRole: jest.fn(),
  };
  const bus: IEventBus = { publish: jest.fn().mockResolvedValue(undefined), subscribe: jest.fn() };
  const useCase = new AssignRoleUseCase(roles, userRoles, abilities, bus);
  return { useCase, roles, userRoles, abilities, bus, adminRole };
};

describe('AssignRoleUseCase', () => {
  it('assigns the role and invalidates user abilities', async () => {
    const { useCase, userRoles, abilities, bus, adminRole } = setup();
    const r = await useCase.execute({ userId: 'u-1', roleName: 'admin' });
    expect(r.isOk()).toBe(true);
    expect(userRoles.assign).toHaveBeenCalledWith('u-1', adminRole.id.value);
    expect(abilities.invalidateForUser).toHaveBeenCalledWith('u-1');
    expect(bus.publish).toHaveBeenCalled();
  });

  it('returns RoleNotFoundError when role does not exist', async () => {
    const { useCase, userRoles, bus } = setup();
    const r = await useCase.execute({ userId: 'u-1', roleName: 'ghost' });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error).toBeInstanceOf(RoleNotFoundError);
    expect(userRoles.assign).not.toHaveBeenCalled();
    expect(bus.publish).not.toHaveBeenCalled();
  });
});
