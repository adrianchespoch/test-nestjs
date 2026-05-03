import {
  ConflictDomainError,
  ForbiddenDomainError,
  NotFoundDomainError,
} from '../../../../shared/domain/errors/domain.error';

export class RoleNotFoundError extends NotFoundDomainError {
  override readonly code = 'ROLE_NOT_FOUND';
  constructor(identifier: string) {
    super(`Role not found: ${identifier}`);
  }
}

export class PermissionNotFoundError extends NotFoundDomainError {
  override readonly code = 'PERMISSION_NOT_FOUND';
  constructor(identifier: string) {
    super(`Permission not found: ${identifier}`);
  }
}

export class UserNotFoundError extends NotFoundDomainError {
  override readonly code = 'USER_NOT_FOUND';
  constructor(identifier: string) {
    super(`User not found: ${identifier}`);
  }
}

export class ProtectedRoleError extends ForbiddenDomainError {
  override readonly code = 'PROTECTED_ROLE';
  constructor() {
    super('System roles cannot be modified or removed');
  }
}

export class RoleNameAlreadyExistsError extends ConflictDomainError {
  override readonly code = 'ROLE_NAME_EXISTS';
  constructor(name: string) {
    super(`Role with name '${name}' already exists`);
  }
}

export class RoleInUseError extends ConflictDomainError {
  override readonly code = 'ROLE_IN_USE';
  constructor() {
    super('Role is assigned to one or more users');
  }
}
