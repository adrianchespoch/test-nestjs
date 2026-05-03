import type { DomainError } from '../../../../shared/domain/errors/domain.error';
import {
  ConflictDomainError,
  ForbiddenDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../../shared/domain/errors/domain.error';

export class InvalidEmailError extends ValidationDomainError {
  override readonly code = 'INVALID_EMAIL';
}

export class WeakPasswordError extends ValidationDomainError {
  override readonly code = 'WEAK_PASSWORD';
}

export class EmailAlreadyExistsError extends ConflictDomainError {
  override readonly code = 'EMAIL_ALREADY_EXISTS';
  constructor() {
    super('Email already exists');
  }
}

export class InvalidCredentialsError extends UnauthorizedDomainError {
  override readonly code = 'INVALID_CREDENTIALS';
  constructor() {
    super('Invalid credentials');
  }
}

export class AccountLockedError extends ForbiddenDomainError {
  override readonly code = 'ACCOUNT_LOCKED';
  constructor(public readonly lockedUntil: Date) {
    super('Account is temporarily locked');
  }

  override toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      lockedUntil: this.lockedUntil.toISOString(),
    };
  }
}

export class EmailNotVerifiedError extends ForbiddenDomainError {
  override readonly code = 'EMAIL_NOT_VERIFIED';
  constructor() {
    super('Email is not verified');
  }
}

export class AccountDeactivatedError extends ForbiddenDomainError {
  override readonly code = 'ACCOUNT_DEACTIVATED';
  constructor() {
    super('Account has been deactivated');
  }
}

export class InvalidTokenError extends UnauthorizedDomainError {
  override readonly code = 'INVALID_TOKEN';
  constructor() {
    super('Invalid token');
  }
}

export class TokenReuseDetectedError extends UnauthorizedDomainError {
  override readonly code = 'INVALID_TOKEN';
  // Internamente flag para emitir el evento; al cliente sale como INVALID_TOKEN.
  readonly isReuseDetection = true;
  constructor() {
    super('Invalid token');
  }
}

export class VerificationTokenInvalidError extends ValidationDomainError {
  override readonly code = 'VERIFICATION_TOKEN_INVALID';
  constructor() {
    super('Verification token is invalid or expired');
  }
}

export class ResetTokenInvalidError extends ValidationDomainError {
  override readonly code = 'RESET_TOKEN_INVALID_OR_EXPIRED';
  constructor() {
    super('Reset token is invalid or expired');
  }
}

export class AccountLinkRequiredError extends ConflictDomainError {
  override readonly code = 'ACCOUNT_LINK_REQUIRED';
  constructor() {
    super('An account with this email already exists. Sign in first to link providers.');
  }
}

export class OAuthStateMismatchError extends ValidationDomainError {
  override readonly code = 'OAUTH_STATE_MISMATCH';
  constructor() {
    super('OAuth state validation failed');
  }
}

export class OAuthMissingEmailError extends ValidationDomainError {
  override readonly code = 'OAUTH_MISSING_EMAIL';
  constructor() {
    super('OAuth provider did not return a verified email');
  }
}

export type AuthDomainError =
  | InvalidEmailError
  | WeakPasswordError
  | EmailAlreadyExistsError
  | InvalidCredentialsError
  | AccountLockedError
  | EmailNotVerifiedError
  | AccountDeactivatedError
  | InvalidTokenError
  | TokenReuseDetectedError
  | VerificationTokenInvalidError
  | ResetTokenInvalidError
  | DomainError;
