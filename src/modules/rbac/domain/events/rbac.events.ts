import { BaseDomainEvent } from '../../../../shared/domain/domain-event';

export class RolePermissionsChanged extends BaseDomainEvent {
  readonly name = 'rbac.role.permissions_changed';
  constructor(
    readonly aggregateId: string,
    readonly payload: Readonly<{
      roleId: string;
      roleName: string;
      permissionKeys: string[];
    }>,
  ) {
    super();
  }
}

export class RoleAssigned extends BaseDomainEvent {
  readonly name = 'rbac.role.assigned';
  constructor(
    readonly aggregateId: string,
    readonly payload: Readonly<{ userId: string; roleId: string; roleName: string }>,
  ) {
    super();
  }
}

export class RoleRemoved extends BaseDomainEvent {
  readonly name = 'rbac.role.removed';
  constructor(
    readonly aggregateId: string,
    readonly payload: Readonly<{ userId: string; roleId: string; roleName: string }>,
  ) {
    super();
  }
}
