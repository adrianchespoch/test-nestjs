export interface AccessTokenPayload {
  sub: string; // userId
  sid: string; // sessionId
  iat?: number;
  exp?: number;
}

export interface SignedAccessToken {
  token: string;
  expiresInSec: number;
}

export interface IJwtSigner {
  signAccessToken(payload: AccessTokenPayload): Promise<SignedAccessToken>;
  verifyAccessToken(token: string): Promise<AccessTokenPayload>;
}

export const JWT_SIGNER = Symbol('IJwtSigner');
