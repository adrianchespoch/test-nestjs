import { Entity } from '../../../../shared/domain/entity';
import { ValueObject } from '../../../../shared/domain/value-object';

export class SessionId extends ValueObject<{ value: string }> {
  static of(v: string): SessionId {
    return new SessionId({ value: v });
  }
  static generate(): SessionId {
    return new SessionId({ value: crypto.randomUUID() });
  }
  get value(): string {
    return this.props.value;
  }
}

export interface SessionProps {
  id: SessionId;
  userId: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  lastSeen: Date;
  revokedAt: Date | null;
}

export class Session extends Entity<SessionId> {
  private _props: SessionProps;

  private constructor(props: SessionProps) {
    super(props.id);
    this._props = props;
  }

  static start(input: {
    userId: string;
    userAgent: string | null;
    ip: string | null;
    now: Date;
  }): Session {
    return new Session({
      id: SessionId.generate(),
      userId: input.userId,
      userAgent: input.userAgent,
      ip: input.ip,
      createdAt: input.now,
      lastSeen: input.now,
      revokedAt: null,
    });
  }

  static rehydrate(props: SessionProps): Session {
    return new Session(props);
  }

  get userId(): string {
    return this._props.userId;
  }
  get userAgent(): string | null {
    return this._props.userAgent;
  }
  get ip(): string | null {
    return this._props.ip;
  }
  get createdAt(): Date {
    return this._props.createdAt;
  }
  get lastSeen(): Date {
    return this._props.lastSeen;
  }
  get revokedAt(): Date | null {
    return this._props.revokedAt;
  }

  isRevoked(): boolean {
    return this._props.revokedAt !== null;
  }

  touch(now: Date): void {
    this._props = { ...this._props, lastSeen: now };
  }

  revoke(now: Date): void {
    if (this._props.revokedAt) return;
    this._props = { ...this._props, revokedAt: now };
  }

  toSnapshot(): Readonly<SessionProps> {
    return Object.freeze({ ...this._props });
  }
}
