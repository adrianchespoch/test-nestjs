import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { Result } from '../../../../shared/domain/result';
import type { Email } from '../value-objects/email';
import type { HashedPassword } from '../value-objects/password';
import { UserId } from '../value-objects/user-id';
import {
  AccountDeactivatedError,
  AccountLockedError,
  EmailNotVerifiedError,
  InvalidCredentialsError,
} from '../errors/auth.errors';
import {
  AccountLocked,
  UserLoggedIn,
  UserLoginFailed,
  UserRegistered,
} from '../events/auth.events';

export interface UserProps {
  id: UserId;
  email: Email;
  name: string;
  passwordHash: HashedPassword | null;
  emailVerifiedAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  isActive: boolean;
  mustChangePassword: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LockoutPolicy {
  maxAttempts: number;
  lockoutMinutes: number;
}

const DEFAULT_LOCKOUT_POLICY: LockoutPolicy = { maxAttempts: 5, lockoutMinutes: 15 };

/**
 * Resultado de un intento de login exitoso. El use case crea Session y RefreshToken
 * por separado; el aggregate solo decide si las credenciales son válidas y mantiene
 * los counters de seguridad.
 */
export interface LoginAuthorization {
  userId: UserId;
}

export class User extends AggregateRoot<UserId> {
  private _props: UserProps;

  private constructor(props: UserProps) {
    super(props.id);
    this._props = props;
  }

  // ---- factory: registro ----
  static register(input: {
    email: Email;
    name: string;
    passwordHash: HashedPassword;
    now: Date;
  }): User {
    const id = UserId.generate();
    const user = new User({
      id,
      email: input.email,
      name: input.name,
      passwordHash: input.passwordHash,
      emailVerifiedAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      isActive: true,
      mustChangePassword: false,
      deletedAt: null,
      createdAt: input.now,
      updatedAt: input.now,
    });
    user.addEvent(new UserRegistered(id.value, { email: input.email.value }));
    return user;
  }

  /**
   * Crea un User a partir de un OAuth provider verificado.
   * El user no tiene password local; sólo puede entrar vía el provider externo
   * o haciendo password reset (auto-recovery flow).
   */
  static registerViaOAuth(input: { email: Email; name: string; now: Date }): User {
    const id = UserId.generate();
    const user = new User({
      id,
      email: input.email,
      name: input.name,
      passwordHash: null,
      emailVerifiedAt: input.now,
      failedLoginAttempts: 0,
      lockedUntil: null,
      isActive: true,
      mustChangePassword: false,
      deletedAt: null,
      createdAt: input.now,
      updatedAt: input.now,
    });
    user.addEvent(new UserRegistered(id.value, { email: input.email.value }));
    return user;
  }

  /** Reconstruye desde persistencia. NO emite eventos. */
  static rehydrate(props: UserProps): User {
    return new User(props);
  }

  // ---- queries ----
  get email(): Email {
    return this._props.email;
  }
  get name(): string {
    return this._props.name;
  }
  get passwordHash(): HashedPassword | null {
    return this._props.passwordHash;
  }
  get emailVerifiedAt(): Date | null {
    return this._props.emailVerifiedAt;
  }
  get failedLoginAttempts(): number {
    return this._props.failedLoginAttempts;
  }
  get lockedUntil(): Date | null {
    return this._props.lockedUntil;
  }
  get isActive(): boolean {
    return this._props.isActive;
  }
  get deletedAt(): Date | null {
    return this._props.deletedAt;
  }
  get mustChangePassword(): boolean {
    return this._props.mustChangePassword;
  }
  get createdAt(): Date {
    return this._props.createdAt;
  }
  get updatedAt(): Date {
    return this._props.updatedAt;
  }

  isLocked(now: Date): boolean {
    return this._props.lockedUntil !== null && this._props.lockedUntil.getTime() > now.getTime();
  }

  isEmailVerified(): boolean {
    return this._props.emailVerifiedAt !== null;
  }

  // ---- comandos ----

  /**
   * Intenta autenticar contra el hash propio. NO compara strings — recibe el resultado
   * de comparación del IHasher (que ya hizo verify constant-time).
   * Retorna Err con el motivo y registra evento de login failed/locked.
   */
  tryLogin(input: {
    isPasswordCorrect: boolean;
    now: Date;
    policy?: LockoutPolicy;
  }): Result<
    LoginAuthorization,
    InvalidCredentialsError | AccountLockedError | EmailNotVerifiedError | AccountDeactivatedError
  > {
    const policy = input.policy ?? DEFAULT_LOCKOUT_POLICY;

    if (this._props.deletedAt !== null || !this._props.isActive) {
      this.addEvent(new UserLoginFailed(this.id.value, { reason: 'invalid_credentials' as const }));
      return Result.err(new AccountDeactivatedError());
    }

    if (this.isLocked(input.now)) {
      this.addEvent(new UserLoginFailed(this.id.value, { reason: 'locked' as const }));
      return Result.err(new AccountLockedError(this._props.lockedUntil!));
    }

    if (!input.isPasswordCorrect) {
      this._props = {
        ...this._props,
        failedLoginAttempts: this._props.failedLoginAttempts + 1,
        updatedAt: input.now,
      };
      // ¿hay que bloquear?
      if (this._props.failedLoginAttempts >= policy.maxAttempts) {
        const until = new Date(input.now.getTime() + policy.lockoutMinutes * 60_000);
        this._props = { ...this._props, lockedUntil: until };
        this.addEvent(
          new AccountLocked(this.id.value, {
            until: until.toISOString(),
            failedAttempts: this._props.failedLoginAttempts,
          }),
        );
        this.addEvent(new UserLoginFailed(this.id.value, { reason: 'locked' as const }));
        return Result.err(new AccountLockedError(until));
      }
      this.addEvent(new UserLoginFailed(this.id.value, { reason: 'invalid_credentials' as const }));
      return Result.err(new InvalidCredentialsError());
    }

    if (!this.isEmailVerified()) {
      this.addEvent(new UserLoginFailed(this.id.value, { reason: 'unverified' as const }));
      return Result.err(new EmailNotVerifiedError());
    }

    // login OK — reset counters
    this._props = {
      ...this._props,
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: input.now,
    };
    return Result.ok({ userId: this.id });
  }

  recordSuccessfulSession(input: { sessionId: string; ip?: string; userAgent?: string }): void {
    this.addEvent(new UserLoggedIn(this.id.value, input));
  }

  markEmailVerified(now: Date): void {
    if (this._props.emailVerifiedAt !== null) return;
    this._props = { ...this._props, emailVerifiedAt: now, updatedAt: now };
  }

  changePassword(newHash: HashedPassword, now: Date): void {
    this._props = {
      ...this._props,
      passwordHash: newHash,
      mustChangePassword: false,
      updatedAt: now,
    };
  }

  unlock(now: Date): void {
    this._props = {
      ...this._props,
      lockedUntil: null,
      failedLoginAttempts: 0,
      updatedAt: now,
    };
  }

  /** Snapshot para mappers de persistencia. NO mutar. */
  toSnapshot(): Readonly<UserProps> {
    return Object.freeze({ ...this._props });
  }
}
