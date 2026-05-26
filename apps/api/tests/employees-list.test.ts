import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { users, employees } from '../src/db/schema/index.js';
import { hashPassword } from '../src/auth/password.js';
import type { DbConnection } from '../src/db/client.js';
import { createTestDb } from './helpers/test-db.js';

const TEST_SECRET = 'unit-test-secret-value-12345678901234567890';

interface SeedRow {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  department: string;
  country: string;
  salary: number;
  currency: string;
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
  hireDate: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

function makeEmployee(id: string, overrides: Partial<SeedRow> = {}) {
  return {
    id,
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: `${id}@example.com`,
    jobTitle: 'Software Engineer',
    department: 'Engineering',
    country: 'GB',
    salary: 10000000,
    currency: 'GBP' as const,
    employmentType: 'FULL_TIME' as const,
    hireDate: '2024-01-15',
    status: 'ACTIVE' as const,
    ...overrides,
  };
}

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

function seedFixedRoster(db: DbConnection) {
  // A small, predictable roster across two countries and two job titles
  // so each test can assert exact counts and content.
  const rows = [
    makeEmployee('e1', {
      firstName: 'Ada',
      lastName: 'Lovelace',
      country: 'GB',
      jobTitle: 'Software Engineer',
    }),
    makeEmployee('e2', {
      firstName: 'Grace',
      lastName: 'Hopper',
      country: 'US',
      jobTitle: 'Software Engineer',
    }),
    makeEmployee('e3', {
      firstName: 'Linus',
      lastName: 'Torvalds',
      country: 'US',
      jobTitle: 'Engineering Manager',
    }),
    makeEmployee('e4', {
      firstName: 'Margaret',
      lastName: 'Hamilton',
      country: 'US',
      jobTitle: 'Software Engineer',
    }),
    makeEmployee('e5', {
      firstName: 'Donald',
      lastName: 'Knuth',
      country: 'US',
      jobTitle: 'Engineering Manager',
    }),
    makeEmployee('e6', {
      firstName: 'Barbara',
      lastName: 'Liskov',
      country: 'GB',
      jobTitle: 'Engineering Manager',
    }),
    makeEmployee('e7', {
      firstName: 'Edsger',
      lastName: 'Dijkstra',
      country: 'NL',
      jobTitle: 'Software Engineer',
      status: 'INACTIVE',
    }),
  ];
  db.insert(employees).values(rows).run();
}

describe('GET /employees', () => {
  let app: Express;
  let db: DbConnection;
  let cookie: string;

  beforeEach(async () => {
    ({ app, db, cookie } = await buildApp());
    seedFixedRoster(db);
  });

  it('returns 401 when called without authentication', async () => {
    const res = await request(app).get('/employees');
    expect(res.status).toBe(401);
  });

  it('returns a paginated envelope with items, page, pageSize, total, totalPages', async () => {
    const res = await request(app).get('/employees').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        items: expect.any(Array),
        page: expect.any(Number),
        pageSize: expect.any(Number),
        total: expect.any(Number),
        totalPages: expect.any(Number),
      }),
    );
  });

  it('hides soft-deleted (INACTIVE) employees by default', async () => {
    const res = await request(app).get('/employees').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(6); // 7 seeded - 1 INACTIVE
    const emails: string[] = res.body.items.map((e: { email: string }) => e.email);
    expect(emails).not.toContain('e7@example.com');
  });

  it('respects page and pageSize query params', async () => {
    const res = await request(app).get('/employees?page=2&pageSize=2').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.pageSize).toBe(2);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBe(6);
    expect(res.body.totalPages).toBe(3);
  });

  it('filters by country', async () => {
    const res = await request(app).get('/employees?country=US').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    const countries: string[] = res.body.items.map((e: { country: string }) => e.country);
    expect(countries.every((c) => c === 'US')).toBe(true);
  });

  it('filters by jobTitle', async () => {
    const res = await request(app)
      .get('/employees?jobTitle=Engineering%20Manager')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
  });

  it('combines country and jobTitle filters', async () => {
    const res = await request(app)
      .get('/employees?country=US&jobTitle=Software%20Engineer')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  it('supports case-insensitive search on first name, last name, and email', async () => {
    const byFirst = await request(app).get('/employees?search=grace').set('Cookie', cookie);
    expect(byFirst.body.total).toBe(1);
    expect(byFirst.body.items[0].email).toBe('e2@example.com');

    const byLast = await request(app).get('/employees?search=KNUTH').set('Cookie', cookie);
    expect(byLast.body.total).toBe(1);
    expect(byLast.body.items[0].lastName).toBe('Knuth');

    const byEmail = await request(app).get('/employees?search=e1@').set('Cookie', cookie);
    expect(byEmail.body.total).toBe(1);
    expect(byEmail.body.items[0].email).toBe('e1@example.com');
  });

  it('shows INACTIVE employees when status=INACTIVE is passed', async () => {
    const res = await request(app).get('/employees?status=INACTIVE').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].email).toBe('e7@example.com');
  });

  it('returns 400 for pageSize above 100', async () => {
    const res = await request(app).get('/employees?pageSize=500').set('Cookie', cookie);
    expect(res.status).toBe(400);
  });

  it('returns 400 for page below 1', async () => {
    const res = await request(app).get('/employees?page=0').set('Cookie', cookie);
    expect(res.status).toBe(400);
  });
});
