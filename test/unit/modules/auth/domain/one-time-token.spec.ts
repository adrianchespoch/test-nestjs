import {
  OneTimeToken,
  OneTimeTokenId,
  ONE_TIME_TOKEN_TTL,
} from '../../../../../src/modules/auth/domain/entities/one-time-token';

const NOW = new Date('2026-05-03T10:00:00Z');

const issue = (purpose: 'email-verification' | 'password-reset' = 'email-verification') =>
  OneTimeToken.issue({
    id: OneTimeTokenId.of(crypto.randomUUID()),
    hash: 'h',
    purpose,
    userId: 'u-1',
    now: NOW,
  });

describe('OneTimeToken', () => {
  it('email-verification has 24h TTL', () => {
    const t = issue('email-verification');
    const expected = NOW.getTime() + ONE_TIME_TOKEN_TTL['email-verification'] * 1000;
    expect(t.expiresAt.getTime()).toBe(expected);
  });

  it('password-reset has 30min TTL', () => {
    const t = issue('password-reset');
    const expected = NOW.getTime() + ONE_TIME_TOKEN_TTL['password-reset'] * 1000;
    expect(t.expiresAt.getTime()).toBe(expected);
  });

  it('isValid returns true while not used and not expired', () => {
    const t = issue();
    expect(t.isValid(NOW)).toBe(true);
  });

  it('isValid returns false when expired', () => {
    const t = issue('password-reset');
    const later = new Date(t.expiresAt.getTime() + 1);
    expect(t.isValid(later)).toBe(false);
  });

  it('isValid returns false once marked used', () => {
    const t = issue();
    t.markUsed(NOW);
    expect(t.isValid(NOW)).toBe(false);
    expect(t.isUsed()).toBe(true);
  });

  it('markUsed is idempotent', () => {
    const t = issue();
    t.markUsed(NOW);
    const before = t.usedAt;
    t.markUsed(new Date(NOW.getTime() + 1000));
    expect(t.usedAt).toEqual(before);
  });
});
