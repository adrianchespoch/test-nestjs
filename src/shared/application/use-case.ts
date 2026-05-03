import type { Result } from '../domain/result';
import type { DomainError } from '../domain/errors/domain.error';

/**
 * Base type para use cases. Todos retornan Result, nunca throw para errores de negocio.
 */
export interface UseCase<Input, Output, E extends DomainError = DomainError> {
  execute(input: Input): Promise<Result<Output, E>>;
}
