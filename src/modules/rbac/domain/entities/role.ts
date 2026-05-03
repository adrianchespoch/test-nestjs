import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { RoleId } from '../value-objects/role-id';
import type { Permission } from './permission';
import { RolePermissionsChanged } from '../events/rbac.events';

export interface RoleProps {
  id: RoleId;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
  /** Permisos efectivos del rol. */
  permissions: Permission[];
}

const NAME_RE = /^[a-z][a-z0-9_-]{1,58}$/;

export class Role extends AggregateRoot<RoleId> {
  private _props: RoleProps;

  private constructor(props: RoleProps) {
    super(props.id);
    this._props = props;
  }

  static create(input: {
    name: string;
    description: string | null;
    isSystem: boolean;
    now: Date;
    permissions?: Permission[];
  }): Role {
    if (!NAME_RE.test(input.name)) {
      throw new Error(`Invalid role name: ${input.name}`);
    }
    return new Role({
      id: RoleId.generate(),
      name: input.name,
      description: input.description,
      isSystem: input.isSystem,
      createdAt: input.now,
      permissions: input.permissions ?? [],
    });
  }

  static rehydrate(props: RoleProps): Role {
    return new Role(props);
  }

  get name(): string {
    return this._props.name;
  }
  get description(): string | null {
    return this._props.description;
  }
  get isSystem(): boolean {
    return this._props.isSystem;
  }
  get createdAt(): Date {
    return this._props.createdAt;
  }
  get permissions(): readonly Permission[] {
    return this._props.permissions;
  }

  /** Reemplaza el set de permisos. Emite evento si cambió. */
  replacePermissions(newPermissions: Permission[]): void {
    if (this._props.isSystem) {
      throw new Error('Cannot modify a system role');
    }
    const before = this._props.permissions
      .map((p) => `${p.action}:${p.subject}`)
      .sort()
      .join(',');
    const after = newPermissions
      .map((p) => `${p.action}:${p.subject}`)
      .sort()
      .join(',');
    if (before === after) return;

    this._props = { ...this._props, permissions: [...newPermissions] };
    this.addEvent(
      new RolePermissionsChanged(this.id.value, {
        roleId: this.id.value,
        roleName: this._props.name,
        permissionKeys: newPermissions.map((p) => `${p.action}:${p.subject}`),
      }),
    );
  }

  toSnapshot(): Readonly<RoleProps> {
    return Object.freeze({
      ...this._props,
      permissions: [...this._props.permissions],
    });
  }
}
