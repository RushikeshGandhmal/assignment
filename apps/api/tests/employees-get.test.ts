import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { users, employees } from '../src/db/schema/index.js';
import { hashPassword } from '../src/auth/password.js';
import type { DbConnection } from '../src/db/client.js';
import { createTestDb } from './helpers/test-db.js';

const TEST_SECRET = 'unit-test-secret-value-12345678901234567890';

async function buildApp(): Promise<{ app: Express; db: DbConnection; cookie: string }> {
  const db = createTestDb();
  const passwordHash = await hashPassword('s3cret-pass');
  db.insert(users).values({ id: 'usr_admin', email: 'hr@example.com', passwordHash }).run();
  const app = createApp({ db, jwtSecret: TEST_SECRET });

  const loginRes = await request(app)
    .post('/auth/login')
    .send({ email: 'hr@example.com', password: 's3cret-pass' });
  const setCookie = loginRes.headers['set-cookie'] as unknown;
  const cookies = Array.isArray(setCookie) ? setCookie : [String(setCookie)];
  const cookie = cookies.map((c) => c.split(';')[0]).join('; ');

  return { app, db, cookie };
}

const baseRow = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  jobTitle: 'Software Engineer',
  department: 'Engineering',
  country: 'GB',
  salary: 12000000,
  currency: 'GBP' as const,
  employmentType: 'FULL_TIME' as const,
  hireDate: '2024-01-15',
};

describe('GET /employees/:id', () => {
  let app: Express;
  let db: DbConnection;
  let cookie: string;

  beforeEach(async () => {
    ({ app, db, cookie } = await buildApp());
    db.insert(employees)
      .values([
        { id: 'emp-active', email: 'active@example.com', status: 'ACTIVE', ...baseRow },
        { id: 'emp-inactive', email: 'inactive@example.com', status: 'INACTIVE', ...baseRow },
      ])
      .run();
  });

  it('returns 401 when called without authentication', async () => {
    const res = await request(app).get('/employees/emp-active');
    expect(res.status).toBe(401);
  });

  it('returns 200 and the employee for a known id', async () => {
    const res = await request(app).get('/employees/emp-active').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'emp-active',
      email: 'active@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      jobTitle: 'Software Engineer',
      department: 'Engineering',
      country: 'GB',
      salary: 12000000,
      currency: 'GBP',
      employmentType: 'FULL_TIME',
      hireDate: '2024-01-15',
      status: 'ACTIVE',
    });
    expect(res.body.createdAt).toEqual(expect.any(Number));
    expect(res.body.updatedAt).toEqual(expect.any(Number));
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).get('/employees/does-not-exist').set('Cookie', cookie);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('still returns INACTIVE employees (soft-deleted rows remain retrievable)', async () => {
    const res = await request(app).get('/employees/emp-inactive').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'emp-inactive', status: 'INACTIVE' });
  });
});
