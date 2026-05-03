import { ValueObject } from '../../../../shared/domain/value-object';
import { Result } from '../../../../shared/domain/result';
import { WeakPasswordError } from '../errors/auth.errors';

/**
 * Password en claro. Se valida contra una policy mínima.
 * NUNCA se persiste — siempre se hashea vía IHasher antes de guardar.
 */
export class Password extends ValueObject<{ value: string }> {
  static readonly MIN_LENGTH = 12;
  static readonly MAX_LENGTH = 128;

  static create(raw: unknown): Result<Password, WeakPasswordError> {
    if (typeof raw !== 'string') {
      return Result.err(new WeakPasswordError('Password must be a string'));
    }
    if (raw.length < Password.MIN_LENGTH) {
      return Result.err(
        new WeakPasswordError(`Password must be at least ${Password.MIN_LENGTH} characters`),
      );
    }
    if (raw.length > Password.MAX_LENGTH) {
      return Result.err(
        new WeakPasswordError(`Password must be at most ${Password.MAX_LENGTH} characters`),
      );
    }
    // Heurística simple: requiere al menos 3 de 4 clases de caracteres.
    let classes = 0;
    if (/[a-z]/.test(raw)) classes += 1;
    if (/[A-Z]/.test(raw)) classes += 1;
    if (/\d/.test(raw)) classes += 1;
    if (/[^A-Za-z0-9]/.test(raw)) classes += 1;
    if (classes < 3) {
      return Result.err(
        new WeakPasswordError(
          'Password must include at least 3 of: lowercase, uppercase, digit, symbol',
        ),
      );
    }
    return Result.ok(new Password({ value: raw }));
  }

  get value(): string {
    return this.props.value;
  }
}

/**
 * Hash producido por IHasher. Se trata como opaco — el VO no inspecciona el formato
 * más allá de garantizar que es no vacío.
 */
export class HashedPassword extends ValueObject<{ value: string }> {
  static fromHash(value: string): HashedPassword {
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error('HashedPassword must be a non-empty string');
    }
    return new HashedPassword({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
