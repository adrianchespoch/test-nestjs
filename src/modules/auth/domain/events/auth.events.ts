import { BaseDomainEvent } from '../../../../shared/domain/domain-event';

export class UserRegistered extends BaseDomainEvent {
  readonly name = 'auth.user.registered';
  constructor(
    readonly aggregateId: string,
    readonly payload: Readonly<{ email: string }>,
  ) {
    super();
  }
}

export class UserLoggedIn extends BaseDomainEvent {
  readonly name = 'auth.user.logged_in';
  constructor(
    readonly aggregateId: string,
    readonly payload: Readonly<{ sessionId: string; ip?: string; userAgent?: string }>,
  ) {
    super();
  }
}

export class UserLoginFailed extends BaseDomainEvent {
  readonly name = 'auth.user.login_failed';
  constructor(
    readonly aggregateId: string,
    readonly payload: Readonly<{ reason: 'invalid_credentials' | 'locked' | 'unverified' }>,
  ) {
    super();
  }
}

export class AccountLocked extends BaseDomainEvent {
  readonly name = 'auth.account.locked';
  constructor(
    readonly aggregateId: string,
    readonly payload: Readonly<{ until: string; failedAttempts: number }>,
  ) {
    super();
  }
}

export class RefreshTokenRotated extends BaseDomainEvent {
  readonly name = 'auth.refresh_token.rotated';
  constructor(
    readonly aggregateId: string,
    readonly payload: Readonly<{ familyId: string; oldTokenId: string; newTokenId: string }>,
  ) {
    super();
  }
}

export class RefreshTokenReuseDetected extends BaseDomainEvent {
  readonly name = 'auth.refresh_token.reuse_detected';
  readonly severity = 'high' as const;
  constructor(
    readonly aggregateId: string,
    readonly payload: Readonly<{ familyId: string; reusedTokenId: string }>,
  ) {
    super();
  }
}

export class UserLoggedOut extends BaseDomainEvent {
  readonly name = 'auth.user.logged_out';
  constructor(
    readonly aggregateId: string,
    readonly payload: Readonly<{ sessionId: string }>,
  ) {
    super();
  }
}
