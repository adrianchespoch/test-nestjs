import { ValueObject } from '../../../../shared/domain/value-object';

/** Acciones canónicas. Strings adicionales son válidas (CASL es abierto). */
export type Action =
  | 'manage'
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'unlock'
  | 'list'
  | string;

/** 'all' = wildcard CASL. Otros subjects son tipos del dominio. */
export type Subject = 'all' | 'User' | 'Role' | 'Permission' | string;

/**
 * PermissionKey identifica una permission por (action, subject).
 * Ej: 'unlock:User'.
 */
export class PermissionKey extends ValueObject<{ action: string; subject: string }> {
  static of(action: Action, subject: Subject): PermissionKey {
    if (!action || !subject) throw new Error('action and subject required');
    return new PermissionKey({ action: String(action), subject: String(subject) });
  }

  static parse(raw: string): PermissionKey {
    const [action, subject] = raw.split(':');
    if (!action || !subject) throw new Error(`Invalid permission key: ${raw}`);
    return PermissionKey.of(action, subject);
  }

  get action(): string {
    return this.props.action;
  }
  get subject(): string {
    return this.props.subject;
  }

  toString(): string {
    return `${this.props.action}:${this.props.subject}`;
  }
}
