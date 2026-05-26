import { describe, expect, it } from 'vitest';
import { signAuthToken, verifyAuthToken } from '../src/auth/jwt.js';

const secret = 'test-secret-that-is-long-enough-to-be-safe';

describe('jwt utilities', () => {
  it('signs a token containing the user id and email claims', () => {
    const token = signAuthToken({ sub: 'usr_admin', email: 'hr@example.com' }, secret);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
  });

  it('verifies a token signed with the same secret and returns the payload', () => {
    const token = signAuthToken({ sub: 'usr_admin', email: 'hr@example.com' }, secret);
    const payload = verifyAuthToken(token, secret);
    expect(payload).toMatchObject({ sub: 'usr_admin', email: 'hr@example.com' });
  });

  it('rejects a token signed with a different secret', () => {
    const token = signAuthToken({ sub: 'usr_admin', email: 'hr@example.com' }, secret);
    expect(() => verifyAuthToken(token, 'a-different-secret-value')).toThrow();
  });

  it('rejects a malformed token', () => {
    expect(() => verifyAuthToken('not-a-real-token', secret)).toThrow();
  });
});
