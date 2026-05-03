/**
 * Errores de dominio. Llevados como valores en `Result.Err`, NO se tiran como excepciones.
 * Cada subclase tiene un `code` estable que el filtro HTTP usa para mapear a status.
 *
 * Ver `architecture/cross-cutting/error-handling.md`.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  /** HTTP status sugerido. El filter puede sobrescribirlo. */
  readonly httpStatus: number = 400;

  /** Detalles seguros de exponer al cliente (sin PII / sin internals). */
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    if (details !== undefined) this.details = details;
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

/** Validación de input que el dominio rechaza (ej. email inválido). */
export class ValidationDomainError extends DomainError {
  readonly code: string = 'VALIDATION_ERROR';
  override readonly httpStatus = 400;
}

/** Recurso no encontrado (cuando el caller tiene permiso para saberlo). */
export class NotFoundDomainError extends DomainError {
  readonly code: string = 'NOT_FOUND';
  override readonly httpStatus = 404;
}

/** Conflicto de estado (ej. email duplicado, token reusado). */
export class ConflictDomainError extends DomainError {
  readonly code: string = 'CONFLICT';
  override readonly httpStatus = 409;
}

/** El caller no está autenticado o sus credenciales son inválidas. */
export class UnauthorizedDomainError extends DomainError {
  readonly code: string = 'UNAUTHORIZED';
  override readonly httpStatus = 401;
}

/** El caller no tiene permiso para esta acción. */
export class ForbiddenDomainError extends DomainError {
  readonly code: string = 'FORBIDDEN';
  override readonly httpStatus = 403;
}

/** Pre-condición de negocio rota (ej. cuenta bloqueada). */
export class BusinessRuleViolationError extends DomainError {
  readonly code: string = 'BUSINESS_RULE_VIOLATION';
  override readonly httpStatus = 422;
}
