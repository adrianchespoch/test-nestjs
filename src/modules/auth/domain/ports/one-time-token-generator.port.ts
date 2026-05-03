/**
 * Genera tokens de un solo uso (raw + hash). Mismo patrón que IRefreshTokenGenerator
 * pero separado porque el dominio puede querer distintas implementaciones (longitud,
 * encoding) entre ambos.
 */
export interface GeneratedOneTimeToken {
  raw: string;
  hash: string;
}

export interface IOneTimeTokenGenerator {
  generate(): GeneratedOneTimeToken;
  hashOf(raw: string): string;
}

export const ONE_TIME_TOKEN_GENERATOR = Symbol('IOneTimeTokenGenerator');
