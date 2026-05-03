/**
 * Genera tokens de refresh (raw + hash). El raw se entrega al cliente; solo el hash
 * se persiste. Mantiene la lógica de generación detrás de un port para testabilidad.
 */
export interface GeneratedRefreshToken {
  raw: string;
  hash: string;
}

export interface IRefreshTokenGenerator {
  generate(): GeneratedRefreshToken;
  hashOf(raw: string): string;
}

export const REFRESH_TOKEN_GENERATOR = Symbol('IRefreshTokenGenerator');
