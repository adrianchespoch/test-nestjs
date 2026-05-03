import { Entity } from '../../../../shared/domain/entity';
import { ValueObject } from '../../../../shared/domain/value-object';
import type { OAuthProvider } from '../value-objects/oauth-profile';

export class AccountProviderId extends ValueObject<{ value: string }> {
  static of(v: string): AccountProviderId {
    return new AccountProviderId({ value: v });
  }
  static generate(): AccountProviderId {
    return new AccountProviderId({ value: crypto.randomUUID() });
  }
  get value(): string {
    return this.props.value;
  }
}

export interface AccountProviderProps {
  id: AccountProviderId;
  userId: string;
  provider: OAuthProvider;
  providerAccountId: string;
  createdAt: Date;
}

/**
 * Vínculo entre un User local y la cuenta externa del provider.
 * Llave de negocio: (provider, providerAccountId).
 */
export class AccountProvider extends Entity<AccountProviderId> {
  private _props: AccountProviderProps;

  private constructor(props: AccountProviderProps) {
    super(props.id);
    this._props = props;
  }

  static create(input: {
    userId: string;
    provider: OAuthProvider;
    providerAccountId: string;
    now: Date;
  }): AccountProvider {
    return new AccountProvider({
      id: AccountProviderId.generate(),
      userId: input.userId,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
      createdAt: input.now,
    });
  }

  static rehydrate(props: AccountProviderProps): AccountProvider {
    return new AccountProvider(props);
  }

  get userId(): string {
    return this._props.userId;
  }
  get provider(): OAuthProvider {
    return this._props.provider;
  }
  get providerAccountId(): string {
    return this._props.providerAccountId;
  }
  get createdAt(): Date {
    return this._props.createdAt;
  }

  toSnapshot(): Readonly<AccountProviderProps> {
    return Object.freeze({ ...this._props });
  }
}
