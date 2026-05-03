import { Entity } from '../../../../shared/domain/entity';
import { ValueObject } from '../../../../shared/domain/value-object';

export class RefreshTokenId extends ValueObject<{ value: string }> {
  static of(v: string): RefreshTokenId {
    return new RefreshTokenId({ value: v });
  }
  get value(): string {
    return this.props.value;
  }
}

export interface RefreshTokenProps {
  id: RefreshTokenId;
  /** Hash sha-256 del token raw — el raw nunca se persiste. */
  hash: string;
  familyId: string;
  parentId: string | null;
  sessionId: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  reuseDetectedAt: Date | null;
  createdAt: Date;
}

/**
 * RefreshToken — entity dentro del aggregate Session.
 * Un token pertenece a una "familia" que comparte ancestro común.
 * Reuso detectado en cualquier token revoca toda la familia.
 */
export class RefreshToken extends Entity<RefreshTokenId> {
  private _props: RefreshTokenProps;

  private constructor(props: RefreshTokenProps) {
    super(props.id);
    this._props = props;
  }

  static create(input: Omit<RefreshTokenProps, 'id'> & { id?: RefreshTokenId }): RefreshToken {
    const id = input.id ?? RefreshTokenId.of(crypto.randomUUID());
    return new RefreshToken({ ...input, id });
  }

  static rehydrate(props: RefreshTokenProps): RefreshToken {
    return new RefreshToken(props);
  }

  get hash(): string {
    return this._props.hash;
  }
  get familyId(): string {
    return this._props.familyId;
  }
  get parentId(): string | null {
    return this._props.parentId;
  }
  get sessionId(): string {
    return this._props.sessionId;
  }
  get userId(): string {
    return this._props.userId;
  }
  get expiresAt(): Date {
    return this._props.expiresAt;
  }
  get revokedAt(): Date | null {
    return this._props.revokedAt;
  }
  get reuseDetectedAt(): Date | null {
    return this._props.reuseDetectedAt;
  }
  get createdAt(): Date {
    return this._props.createdAt;
  }

  isRevoked(): boolean {
    return this._props.revokedAt !== null;
  }

  isExpired(now: Date): boolean {
    return this._props.expiresAt.getTime() <= now.getTime();
  }

  /** Revocación normal (rotación / logout). */
  revoke(now: Date): void {
    if (this._props.revokedAt) return;
    this._props = { ...this._props, revokedAt: now };
  }

  /** Marca este token como reusado (intento de uso post-revocación). */
  flagReuse(now: Date): void {
    this._props = {
      ...this._props,
      reuseDetectedAt: now,
      revokedAt: this._props.revokedAt ?? now,
    };
  }

  toSnapshot(): Readonly<RefreshTokenProps> {
    return Object.freeze({ ...this._props });
  }
}
