import {
  RefreshToken,
  RefreshTokenId,
} from '../../../../../src/modules/auth/domain/entities/refresh-token';

const NOW = new Date('2026-05-03T10:00:00Z');

const make = (overrides?: Partial<Parameters<typeof RefreshToken.create>[0]>) =>
  RefreshToken.create({
    id: RefreshTokenId.of(crypto.randomUUID()),
    hash: 'sha256-hash',
    familyId: 'fam-1',
    parentId: null,
    sessionId: 'sess-1',
    userId: 'user-1',
    expiresAt: new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000),
    revokedAt: null,
    reuseDetectedAt: null,
    createdAt: NOW,
    ...overrides,
  });

describe('RefreshToken', () => {
  it('is not revoked / expired by default', () => {
    const t = make();
    expect(t.isRevoked()).toBe(false);
    expect(t.isExpired(NOW)).toBe(false);
  });

  it('isExpired returns true at or after expiresAt', () => {
    const t = make({ expiresAt: NOW });
    expect(t.isExpired(NOW)).toBe(true);
    expect(t.isExpired(new Date(NOW.getTime() + 1))).toBe(true);
  });

  it('revoke() sets revokedAt and is idempotent', () => {
    const t = make();
    t.revoke(NOW);
    expect(t.isRevoked()).toBe(true);
    const before = t.revokedAt;
    t.revoke(new Date(NOW.getTime() + 1000));
    expect(t.revokedAt).toEqual(before); // no se sobrescribe
  });

  it('flagReuse() sets reuseDetectedAt and revokes if not yet revoked', () => {
    const t = make();
    t.flagReuse(NOW);
    expect(t.reuseDetectedAt).toEqual(NOW);
    expect(t.revokedAt).toEqual(NOW);
  });

  it('flagReuse() preserves the original revokedAt if already revoked', () => {
    const earlier = new Date(NOW.getTime() - 60_000);
    const t = make({ revokedAt: earlier });
    t.flagReuse(NOW);
    expect(t.reuseDetectedAt).toEqual(NOW);
    expect(t.revokedAt).toEqual(earlier); // mantiene el revoked original
  });
});
