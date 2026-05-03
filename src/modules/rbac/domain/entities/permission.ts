import { Entity } from '../../../../shared/domain/entity';
import type { PermissionId } from '../value-objects/role-id';
import { PermissionKey } from '../value-objects/permission-key';

export interface PermissionProps {
  id: PermissionId;
  action: string;
  subject: string;
  /** CASL conditions opcionales. Ej: { ownerId: '$user.id' }. */
  conditions: Readonly<Record<string, unknown>> | null;
  description: string | null;
}

/**
 * Permission — entity reference data.
 * Llave de negocio: (action, subject). El id UUID es solo para FK.
 */
export class Permission extends Entity<PermissionId> {
  private _props: PermissionProps;

  private constructor(props: PermissionProps) {
    super(props.id);
    this._props = props;
  }

  static rehydrate(props: PermissionProps): Permission {
    return new Permission(props);
  }

  get action(): string {
    return this._props.action;
  }
  get subject(): string {
    return this._props.subject;
  }
  get conditions(): Readonly<Record<string, unknown>> | null {
    return this._props.conditions;
  }
  get description(): string | null {
    return this._props.description;
  }

  key(): PermissionKey {
    return PermissionKey.of(this._props.action, this._props.subject);
  }

  toSnapshot(): Readonly<PermissionProps> {
    return Object.freeze({ ...this._props });
  }
}
