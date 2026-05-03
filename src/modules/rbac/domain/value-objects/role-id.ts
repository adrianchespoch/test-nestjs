import { ValueObject } from '../../../../shared/domain/value-object';
import { randomUUID } from 'node:crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class RoleId extends ValueObject<{ value: string }> {
  static generate(): RoleId {
    return new RoleId({ value: randomUUID() });
  }

  static fromString(raw: string): RoleId {
    if (!UUID_RE.test(raw)) throw new Error(`Invalid RoleId: ${raw}`);
    return new RoleId({ value: raw });
  }

  get value(): string {
    return this.props.value;
  }
}

export class PermissionId extends ValueObject<{ value: string }> {
  static generate(): PermissionId {
    return new PermissionId({ value: randomUUID() });
  }

  static fromString(raw: string): PermissionId {
    if (!UUID_RE.test(raw)) throw new Error(`Invalid PermissionId: ${raw}`);
    return new PermissionId({ value: raw });
  }

  get value(): string {
    return this.props.value;
  }
}
