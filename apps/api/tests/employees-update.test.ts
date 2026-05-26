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

describe('PATCH /employees/:id', () => {
  let app: Express;
  let db: DbConnection;
  let cookie: string;

  beforeEach(async () => {
    ({ app, db, cookie } = await buildApp());
    db.insert(employees)
      .values([
        { id: 'emp-1', email: 'ada@example.com', status: 'ACTIVE', ...baseRow },
        { id: 'emp-2', email: 'grace@example.com', status: 'ACTIVE', ...baseRow },
      ])
      .run();
  });

  it('returns 401 when called without authentication', async () => {
    const res = await request(app).patch('/employees/emp-1').send({ jobTitle: 'Staff Engineer' });
    expect(res.status).toBe(401);
  });

  it('returns 200 and the updated employee for a partial update', async () => {
    const res = await request(app)
      .patch('/employees/emp-1')
      .set('Cookie', cookie)
      .send({ jobTitle: 'Staff Engineer' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'emp-1',
      email: 'ada@example.com',
      firstName: 'Ada',
      jobTitle: 'Staff Engineer',
    });
  });

  it('updates multiple fields in a single request', async () => {
    const res = await request(app)
      .patch('/employees/emp-1')
      .set('Cookie', cookie)
      .send({ jobTitle: 'Staff Engineer', salary: 15000000, department: 'Platform' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      jobTitle: 'Staff Engineer',
      salary: 15000000,
      department: 'Platform',
    });
  });

  it('advances updatedAt while leaving createdAt unchanged', async () => {
    const before = await request(app).get('/employees/emp-1').set('Cookie', cookie);
    // Make sure unixepoch ticks at least once between read and write.
    await new Promise((r) => setTimeout(r, 1100));
    const patched = await request(app)
      .patch('/employees/emp-1')
      .set('Cookie', cookie)
      .send({ jobTitle: 'Staff Engineer' });

    expect(patched.body.createdAt).toBe(before.body.createdAt);
    expect(patched.body.updatedAt).toBeGreaterThan(before.body.updatedAt);
  });

  it('ignores attempts to change immutable fields (id, status, createdAt)', async () => {
    const res = await request(app)
      .patch('/employees/emp-1')
      .set('Cookie', cookie)
      .send({ id: 'evil', status: 'INACTIVE', createdAt: 1, jobTitle: 'Staff Engineer' });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('emp-1');
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.jobTitle).toBe('Staff Engineer');
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app)
      .patch('/employees/does-not-exist')
      .set('Cookie', cookie)
      .send({ jobTitle: 'Staff Engineer' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('returns 400 when a field fails validation', async () => {
    const res = await request(app)
      .patch('/employees/emp-1')
      .set('Cookie', cookie)
      .send({ salary: -1 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when the request body is empty', async () => {
    const res = await request(app).patch('/employees/emp-1').set('Cookie', cookie).send({});
    expect(res.status).toBe(400);
  });

  it('allows changing email to a different unused value', async () => {
    const res = await request(app)
      .patch('/employees/emp-1')
      .set('Cookie', cookie)
      .send({ email: 'ada.new@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('ada.new@example.com');
  });

  it('returns 409 when changing email to one already taken', async () => {
    const res = await request(app)
      .patch('/employees/emp-1')
      .set('Cookie', cookie)
      .send({ email: 'grace@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('email_already_exists');
  });
});
