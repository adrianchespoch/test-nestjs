import { BaseDomainEvent } from '../../../../shared/domain/domain-event';
import type { OAuthProvider } from '../value-objects/oauth-profile';

export class OAuthAccountCreated extends BaseDomainEvent {
  readonly name = 'auth.oauth.account_created';
  constructor(
    readonly aggregateId: string,
    readonly payload: Readonly<{
      userId: string;
      provider: OAuthProvider;
      providerAccountId: string;
      email: string;
    }>,
  ) {
    super();
  }
}

export class OAuthAccountLinked extends BaseDomainEvent {
  readonly name = 'auth.oauth.account_linked';
  constructor(
    readonly aggregateId: string,
    readonly payload: Readonly<{
      userId: string;
      provider: OAuthProvider;
      providerAccountId: string;
    }>,
  ) {
    super();
  }
}
