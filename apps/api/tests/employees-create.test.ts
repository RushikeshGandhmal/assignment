import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { users, employees } from '../src/db/schema/index.js';
import { hashPassword } from '../src/auth/password.js';
import type { DbConnection } from '../src/db/client.js';
import { createTestDb } from './helpers/test-db.js';

const TEST_SECRET = 'unit-test-secret-value-12345678901234567890';

const VALID_EMPLOYEE = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada.lovelace@example.com',
  jobTitle: 'Software Engineer',
  department: 'Engineering',
  country: 'GB',
  salary: 12000000,
  currency: 'GBP',
  employmentType: 'FULL_TIME',
  hireDate: '2024-01-15',
};

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

describe('POST /employees', () => {
  let app: Express;
  let cookie: string;

  beforeEach(async () => {
    ({ app, cookie } = await buildApp());
  });

  it('returns 401 when called without authentication', async () => {
    const res = await request(app).post('/employees').send(VALID_EMPLOYEE);
    expect(res.status).toBe(401);
  });

  it('returns 201 and the created employee for a valid request', async () => {
    const res = await request(app).post('/employees').set('Cookie', cookie).send(VALID_EMPLOYEE);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada.lovelace@example.com',
      jobTitle: 'Software Engineer',
      department: 'Engineering',
      country: 'GB',
      salary: 12000000,
      currency: 'GBP',
      employmentType: 'FULL_TIME',
      hireDate: '2024-01-15',
      status: 'ACTIVE',
    });
    expect(res.body.id).toEqual(expect.any(String));
    expect(res.body.createdAt).toEqual(expect.any(Number));
    expect(res.body.updatedAt).toEqual(expect.any(Number));
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/employees')
      .set('Cookie', cookie)
      .send({ firstName: 'Ada' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
  });

  it('returns 400 when email is malformed', async () => {
    const res = await request(app)
      .post('/employees')
      .set('Cookie', cookie)
      .send({ ...VALID_EMPLOYEE, email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when salary is negative', async () => {
    const res = await request(app)
      .post('/employees')
      .set('Cookie', cookie)
      .send({ ...VALID_EMPLOYEE, salary: -100 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when employmentType is not one of the allowed values', async () => {
    const res = await request(app)
      .post('/employees')
      .set('Cookie', cookie)
      .send({ ...VALID_EMPLOYEE, employmentType: 'FREELANCER' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when country is not a 2-letter code', async () => {
    const res = await request(app)
      .post('/employees')
      .set('Cookie', cookie)
      .send({ ...VALID_EMPLOYEE, country: 'United Kingdom' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when hireDate is not an ISO date (YYYY-MM-DD)', async () => {
    const res = await request(app)
      .post('/employees')
      .set('Cookie', cookie)
      .send({ ...VALID_EMPLOYEE, hireDate: '15/01/2024' });
    expect(res.status).toBe(400);
  });

  it('returns 409 when email is already in use', async () => {
    await request(app).post('/employees').set('Cookie', cookie).send(VALID_EMPLOYEE);

    const res = await request(app).post('/employees').set('Cookie', cookie).send(VALID_EMPLOYEE);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('email_already_exists');
  });

  it('persists the employee row to the database', async () => {
    const { app: app2, db, cookie: cookie2 } = await buildApp();
    const res = await request(app2).post('/employees').set('Cookie', cookie2).send(VALID_EMPLOYEE);
    expect(res.status).toBe(201);

    const rows = db.select().from(employees).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe('ada.lovelace@example.com');
  });
});
