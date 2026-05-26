import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/password.js';

describe('password utilities', () => {
  it('hashes a password to a bcrypt string', async () => {
    const hash = await hashPassword('changeme123');
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(hash).not.toContain('changeme123');
  });

  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    await expect(verifyPassword('correct-horse-battery-staple', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('produces a different hash each time (salted)', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a).not.toBe(b);
  });
});
