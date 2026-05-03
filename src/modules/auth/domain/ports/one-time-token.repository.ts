import type { OneTimeToken, OneTimeTokenPurpose } from '../entities/one-time-token';

export interface IOneTimeTokenRepository {
  findByHash(hash: string): Promise<OneTimeToken | null>;
  save(token: OneTimeToken): Promise<void>;
  /** Marca todos los tokens vivos del user con ese propósito como usados (para evitar tokens en flight). */
  invalidateAllForUser(userId: string, purpose: OneTimeTokenPurpose, now: Date): Promise<void>;
}

export const ONE_TIME_TOKEN_REPOSITORY = Symbol('IOneTimeTokenRepository');
