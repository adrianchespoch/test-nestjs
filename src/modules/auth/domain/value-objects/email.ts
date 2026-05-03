import { ValueObject } from '../../../../shared/domain/value-object';
import { Result } from '../../../../shared/domain/result';
import { InvalidEmailError } from '../errors/auth.errors';

// RFC-5321 dice máximo 254. RFC-5322 regex: aceptamos forma simplificada
// que cubre el 99% en la práctica sin bloquear edge cases legítimos.
const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export class Email extends ValueObject<{ value: string }> {
  static create(raw: unknown): Result<Email, InvalidEmailError> {
    if (typeof raw !== 'string') return Result.err(new InvalidEmailError('Email must be a string'));
    const trimmed = raw.trim().toLowerCase();
    if (trimmed.length === 0 || trimmed.length > 254) {
      return Result.err(new InvalidEmailError('Email length must be 1..254'));
    }
    if (!EMAIL_RE.test(trimmed)) {
      return Result.err(new InvalidEmailError('Email format invalid'));
    }
    return Result.ok(new Email({ value: trimmed }));
  }

  /** Solo para reconstruir desde DB; asume el valor es válido. NO usar para input externo. */
  static fromTrustedString(value: string): Email {
    return new Email({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
