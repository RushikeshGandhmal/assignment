import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { users } from '../src/db/schema/index.js';
import { hashPassword } from '../src/auth/password.js';
import { createTestDb } from './helpers/test-db.js';

const TEST_SECRET = 'unit-test-secret-value-12345678901234567890';

async function buildAppWithUser() {
  const db = createTestDb();
  const passwordHash = await hashPassword('s3cret-pass');
  db.insert(users).values({ id: 'usr_admin', email: 'hr@example.com', passwordHash }).run();
  const app = createApp({ db, jwtSecret: TEST_SECRET });
  return { app, db };
}

describe('POST /auth/login', () => {
  it('returns 200 and sets an httpOnly auth cookie for valid credentials', async () => {
    const { app } = await buildAppWithUser();

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'hr@example.com', password: 's3cret-pass' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ user: { email: 'hr@example.com' } });

    const setCookie = res.headers['set-cookie'] as unknown;
    const cookies = Array.isArray(setCookie) ? setCookie : [String(setCookie)];
    const authCookie = cookies.find((c) => c.startsWith('auth='));
    expect(authCookie).toBeDefined();
    expect(authCookie).toMatch(/HttpOnly/i);
    expect(authCookie).toMatch(/SameSite/i);
  });

  it('returns 401 for a wrong password', async () => {
    const { app } = await buildAppWithUser();
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'hr@example.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for an unknown email', async () => {
    const { app } = await buildAppWithUser();
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'ghost@example.com', password: 's3cret-pass' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid request body', async () => {
    const { app } = await buildAppWithUser();
    const res = await request(app).post('/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/logout', () => {
  it('clears the auth cookie', async () => {
    const { app } = await buildAppWithUser();
    const res = await request(app).post('/auth/logout');
    expect(res.status).toBe(200);

    const setCookie = res.headers['set-cookie'] as unknown;
    const cookies = Array.isArray(setCookie) ? setCookie : [String(setCookie)];
    const authCookie = cookies.find((c) => c.startsWith('auth='));
    expect(authCookie).toBeDefined();
    // Cleared cookies are empty-valued and expired.
    expect(authCookie).toMatch(/auth=;/);
  });
});

describe('auth middleware', () => {
  let app: Awaited<ReturnType<typeof buildAppWithUser>>['app'];

  beforeEach(async () => {
    ({ app } = await buildAppWithUser());
  });

  it('returns 401 when calling /auth/me without a cookie', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the authenticated user on /auth/me with a valid cookie', async () => {
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: 'hr@example.com', password: 's3cret-pass' });
    const setCookie = loginRes.headers['set-cookie'] as unknown;
    const cookies = Array.isArray(setCookie) ? setCookie : [String(setCookie)];
    const cookieHeader = cookies.map((c) => c.split(';')[0]).join('; ');

    const meRes = await request(app).get('/auth/me').set('Cookie', cookieHeader);
    expect(meRes.status).toBe(200);
    expect(meRes.body).toMatchObject({ email: 'hr@example.com' });
  });
});
