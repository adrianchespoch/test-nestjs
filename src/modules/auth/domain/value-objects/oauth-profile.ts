import { ValueObject } from '../../../../shared/domain/value-object';
import type { Email } from './email';

export type OAuthProvider = 'google' | 'github';

export interface OAuthProfileProps extends Record<string, unknown> {
  provider: OAuthProvider;
  /** ID externo del provider (Google `sub`, GitHub `id`). */
  providerAccountId: string;
  email: Email;
  name: string;
  emailVerifiedByProvider: boolean;
}

/**
 * Información mínima retornada por el provider de OAuth tras el flow.
 * Construido desde el strategy de Passport. Inmutable.
 */
export class OAuthProfile extends ValueObject<OAuthProfileProps> {
  static create(props: {
    provider: OAuthProvider;
    providerAccountId: string;
    email: Email;
    name: string;
    emailVerifiedByProvider?: boolean;
  }): OAuthProfile {
    return new OAuthProfile({
      provider: props.provider,
      providerAccountId: String(props.providerAccountId),
      email: props.email,
      name: props.name.trim().slice(0, 120),
      emailVerifiedByProvider: props.emailVerifiedByProvider ?? true,
    });
  }

  get provider(): OAuthProvider {
    return this.props.provider;
  }
  get providerAccountId(): string {
    return this.props.providerAccountId;
  }
  get email(): Email {
    return this.props.email;
  }
  get name(): string {
    return this.props.name;
  }
  get emailVerifiedByProvider(): boolean {
    return this.props.emailVerifiedByProvider;
  }
}
