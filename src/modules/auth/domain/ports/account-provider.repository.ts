import type { AccountProvider } from '../entities/account-provider';
import type { OAuthProvider } from '../value-objects/oauth-profile';

export interface IAccountProviderRepository {
  findByProviderAccount(
    provider: OAuthProvider,
    providerAccountId: string,
  ): Promise<AccountProvider | null>;
  findAllForUser(userId: string): Promise<AccountProvider[]>;
  save(link: AccountProvider): Promise<void>;
}

export const ACCOUNT_PROVIDER_REPOSITORY = Symbol('IAccountProviderRepository');
