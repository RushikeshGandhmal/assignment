import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
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

describe('DELETE /employees/:id (soft delete)', () => {
  let app: Express;
  let db: DbConnection;
  let cookie: string;

  beforeEach(async () => {
    ({ app, db, cookie } = await buildApp());
    db.insert(employees)
      .values([
        { id: 'emp-1', email: 'ada@example.com', status: 'ACTIVE', ...baseRow },
        { id: 'emp-2', email: 'grace@example.com', status: 'INACTIVE', ...baseRow },
      ])
      .run();
  });

  it('returns 401 when called without authentication', async () => {
    const res = await request(app).delete('/employees/emp-1');
    expect(res.status).toBe(401);
  });

  it('returns 204 with no body for an existing employee', async () => {
    const res = await request(app).delete('/employees/emp-1').set('Cookie', cookie);
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it('marks the employee as INACTIVE instead of hard-deleting', async () => {
    await request(app).delete('/employees/emp-1').set('Cookie', cookie);

    const row = db.select().from(employees).where(eq(employees.id, 'emp-1')).get();
    expect(row).toBeDefined();
    expect(row?.status).toBe('INACTIVE');
  });

  it('hides the deleted employee from the default list', async () => {
    await request(app).delete('/employees/emp-1').set('Cookie', cookie);

    const list = await request(app).get('/employees').set('Cookie', cookie);
    const ids: string[] = list.body.items.map((e: { id: string }) => e.id);
    expect(ids).not.toContain('emp-1');
  });

  it('exposes the deleted employee under ?status=INACTIVE', async () => {
    await request(app).delete('/employees/emp-1').set('Cookie', cookie);

    const list = await request(app).get('/employees?status=INACTIVE').set('Cookie', cookie);
    const ids: string[] = list.body.items.map((e: { id: string }) => e.id);
    expect(ids).toContain('emp-1');
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).delete('/employees/does-not-exist').set('Cookie', cookie);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('is idempotent — deleting an already-INACTIVE employee returns 204', async () => {
    const res = await request(app).delete('/employees/emp-2').set('Cookie', cookie);
    expect(res.status).toBe(204);

    const row = db.select().from(employees).where(eq(employees.id, 'emp-2')).get();
    expect(row?.status).toBe('INACTIVE');
  });

  it('advances updatedAt on soft delete', async () => {
    const before = await request(app).get('/employees/emp-1').set('Cookie', cookie);
    await new Promise((r) => setTimeout(r, 1100));

    await request(app).delete('/employees/emp-1').set('Cookie', cookie);
    const after = await request(app).get('/employees/emp-1').set('Cookie', cookie);

    expect(after.body.updatedAt).toBeGreaterThan(before.body.updatedAt);
  });
});
