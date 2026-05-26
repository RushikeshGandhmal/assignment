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
  firstName: 'Sample',
  lastName: 'Person',
  department: 'Engineering',
  employmentType: 'FULL_TIME' as const,
  hireDate: '2024-01-15',
  status: 'ACTIVE' as const,
};

/**
 * Seeds a country drilldown roster. All salaries are native minor units.
 *
 * US ACTIVE (5 rows):
 *   - SE: 100k, 200k, 300k, 400k, 500k -> min 100k, max 500k, avg 300k, median 300k
 *   - PM: 250k, 350k                    -> avg 300k (mixed into all-US data above)
 * US ACTIVE total (7 rows): salaries [100k, 200k, 250k, 300k, 350k, 400k, 500k]
 *   min=100k, max=500k, avg=300k, median=300k
 *
 * US INACTIVE (1 row, 999k) -> must be excluded.
 * IN ACTIVE (1 row, 1_200_000) -> different country, must be excluded from US.
 */
function seedCountryRoster(db: DbConnection) {
  const rows = [
    // US Software Engineers (5)
    {
      id: 'us-se-1',
      country: 'US',
      currency: 'USD',
      salary: 10000000,
      jobTitle: 'Software Engineer',
    },
    {
      id: 'us-se-2',
      country: 'US',
      currency: 'USD',
      salary: 20000000,
      jobTitle: 'Software Engineer',
    },
    {
      id: 'us-se-3',
      country: 'US',
      currency: 'USD',
      salary: 30000000,
      jobTitle: 'Software Engineer',
    },
    {
      id: 'us-se-4',
      country: 'US',
      currency: 'USD',
      salary: 40000000,
      jobTitle: 'Software Engineer',
    },
    {
      id: 'us-se-5',
      country: 'US',
      currency: 'USD',
      salary: 50000000,
      jobTitle: 'Software Engineer',
    },
    // US Product Managers (2)
    {
      id: 'us-pm-1',
      country: 'US',
      currency: 'USD',
      salary: 25000000,
      jobTitle: 'Product Manager',
    },
    {
      id: 'us-pm-2',
      country: 'US',
      currency: 'USD',
      salary: 35000000,
      jobTitle: 'Product Manager',
    },
    // US INACTIVE (must be excluded)
    {
      id: 'us-inactive',
      country: 'US',
      currency: 'USD',
      salary: 99900000,
      jobTitle: 'Software Engineer',
      status: 'INACTIVE' as const,
    },
    // IN ACTIVE (different country)
    {
      id: 'in-1',
      country: 'IN',
      currency: 'INR',
      salary: 120000000,
      jobTitle: 'Software Engineer',
    },
  ];

  db.insert(employees)
    .values(
      rows.map((r) => ({
        ...baseRow,
        ...r,
        email: `${r.id}@example.com`,
        firstName: r.id,
        lastName: 'Person',
      })),
    )
    .run();
}

describe('GET /insights/countries/:country', () => {
  let ctx: { app: Express; db: DbConnection; cookie: string };

  beforeEach(async () => {
    ctx = await buildApp();
    seedCountryRoster(ctx.db);
  });

  it('returns 401 without authentication', async () => {
    const res = await request(ctx.app).get('/insights/countries/US');
    expect(res.status).toBe(401);
  });

  it('returns 200 with the expected response shape', async () => {
    const res = await request(ctx.app).get('/insights/countries/US').set('Cookie', ctx.cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      country: 'US',
      headcount: expect.any(Number),
      salary: {
        min: expect.any(Number),
        max: expect.any(Number),
        avg: expect.any(Number),
        median: expect.any(Number),
      },
      byJobTitle: expect.any(Array),
    });
  });

  it('computes min, max, avg, median across ACTIVE employees in the country', async () => {
    const res = await request(ctx.app).get('/insights/countries/US').set('Cookie', ctx.cookie);
    expect(res.status).toBe(200);
    expect(res.body.headcount).toBe(7);
    expect(res.body.salary.min).toBe(10000000);
    expect(res.body.salary.max).toBe(50000000);
    expect(res.body.salary.avg).toBe(30000000);
    expect(res.body.salary.median).toBe(30000000);
  });

  it('excludes INACTIVE employees from the metrics', async () => {
    const res = await request(ctx.app).get('/insights/countries/US').set('Cookie', ctx.cookie);
    expect(res.status).toBe(200);
    // If INACTIVE were included, max would jump to 99_900_000 and headcount to 8
    expect(res.body.headcount).toBe(7);
    expect(res.body.salary.max).toBe(50000000);
  });

  it('excludes employees in other countries from the metrics', async () => {
    const res = await request(ctx.app).get('/insights/countries/US').set('Cookie', ctx.cookie);
    expect(res.status).toBe(200);
    // The IN employee at 120_000_000 must not raise the US max
    expect(res.body.salary.max).toBe(50000000);
  });

  it('breaks down by job title with min, max, avg, median, and headcount per title', async () => {
    const res = await request(ctx.app).get('/insights/countries/US').set('Cookie', ctx.cookie);
    expect(res.status).toBe(200);
    const titles = res.body.byJobTitle as Array<{
      jobTitle: string;
      headcount: number;
      salary: { min: number; max: number; avg: number; median: number };
    }>;

    const se = titles.find((t) => t.jobTitle === 'Software Engineer');
    expect(se).toBeDefined();
    expect(se).toMatchObject({
      headcount: 5,
      salary: { min: 10000000, max: 50000000, avg: 30000000, median: 30000000 },
    });

    const pm = titles.find((t) => t.jobTitle === 'Product Manager');
    expect(pm).toBeDefined();
    expect(pm).toMatchObject({
      headcount: 2,
      salary: { min: 25000000, max: 35000000, avg: 30000000, median: 30000000 },
    });
  });

  it('orders byJobTitle by headcount descending with job title as tiebreaker', async () => {
    const res = await request(ctx.app).get('/insights/countries/US').set('Cookie', ctx.cookie);
    expect(res.status).toBe(200);
    const titles = res.body.byJobTitle as Array<{ jobTitle: string; headcount: number }>;
    expect(titles.map((t) => t.jobTitle)).toEqual(['Software Engineer', 'Product Manager']);
  });

  it('returns 404 when the country has no ACTIVE employees', async () => {
    const res = await request(ctx.app).get('/insights/countries/JP').set('Cookie', ctx.cookie);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
  });

  it('returns 400 when the country code is not 2 letters', async () => {
    const res = await request(ctx.app).get('/insights/countries/USA').set('Cookie', ctx.cookie);
    expect(res.status).toBe(400);
  });
});
