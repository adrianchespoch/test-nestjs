import type { RefreshToken, RefreshTokenId } from '../entities/refresh-token';

export interface IRefreshTokenRepository {
  findById(id: RefreshTokenId): Promise<RefreshToken | null>;
  findByHash(hash: string): Promise<RefreshToken | null>;
  save(token: RefreshToken): Promise<void>;
  /** Marca todos los tokens activos de la familia como revocados. */
  revokeFamily(familyId: string, now: Date): Promise<void>;
  /** Marca todos los tokens del usuario como revocados (logout-all). */
  revokeAllForUser(userId: string, now: Date): Promise<void>;
}

export const REFRESH_TOKEN_REPOSITORY = Symbol('IRefreshTokenRepository');
