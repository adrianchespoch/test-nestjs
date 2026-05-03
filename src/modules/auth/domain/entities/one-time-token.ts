import { Entity } from '../../../../shared/domain/entity';
import { ValueObject } from '../../../../shared/domain/value-object';

export type OneTimeTokenPurpose = 'email-verification' | 'password-reset';

export class OneTimeTokenId extends ValueObject<{ value: string }> {
  static of(v: string): OneTimeTokenId {
    return new OneTimeTokenId({ value: v });
  }
  get value(): string {
    return this.props.value;
  }
}

export interface OneTimeTokenProps {
  id: OneTimeTokenId;
  hash: string;
  purpose: OneTimeTokenPurpose;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

/** TTLs por propósito (en segundos). */
export const ONE_TIME_TOKEN_TTL = {
  'email-verification': 24 * 60 * 60, // 24h
  'password-reset': 30 * 60, // 30min
} as const;

export class OneTimeToken extends Entity<OneTimeTokenId> {
  private _props: OneTimeTokenProps;

  private constructor(props: OneTimeTokenProps) {
    super(props.id);
    this._props = props;
  }

  static issue(input: {
    id: OneTimeTokenId;
    hash: string;
    purpose: OneTimeTokenPurpose;
    userId: string;
    now: Date;
  }): OneTimeToken {
    const ttlSec = ONE_TIME_TOKEN_TTL[input.purpose];
    return new OneTimeToken({
      id: input.id,
      hash: input.hash,
      purpose: input.purpose,
      userId: input.userId,
      expiresAt: new Date(input.now.getTime() + ttlSec * 1000),
      usedAt: null,
      createdAt: input.now,
    });
  }

  static rehydrate(props: OneTimeTokenProps): OneTimeToken {
    return new OneTimeToken(props);
  }

  get hash(): string {
    return this._props.hash;
  }
  get purpose(): OneTimeTokenPurpose {
    return this._props.purpose;
  }
  get userId(): string {
    return this._props.userId;
  }
  get expiresAt(): Date {
    return this._props.expiresAt;
  }
  get usedAt(): Date | null {
    return this._props.usedAt;
  }
  get createdAt(): Date {
    return this._props.createdAt;
  }

  isUsed(): boolean {
    return this._props.usedAt !== null;
  }

  isExpired(now: Date): boolean {
    return this._props.expiresAt.getTime() <= now.getTime();
  }

  isValid(now: Date): boolean {
    return !this.isUsed() && !this.isExpired(now);
  }

  markUsed(now: Date): void {
    if (this._props.usedAt) return;
    this._props = { ...this._props, usedAt: now };
  }

  toSnapshot(): Readonly<OneTimeTokenProps> {
    return Object.freeze({ ...this._props });
  }
}
