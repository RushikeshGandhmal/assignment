import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { users, employees, currencyRates } from '../src/db/schema/index.js';
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
  jobTitle: 'Software Engineer',
  department: 'Engineering',
  employmentType: 'FULL_TIME' as const,
  hireDate: '2024-01-15',
  status: 'ACTIVE' as const,
};

function seedRosterAndRates(db: DbConnection) {
  // Currency rates: 1 native major unit = X USD major units.
  db.insert(currencyRates)
    .values([
      { currency: 'USD', usdRate: 1.0 },
      { currency: 'INR', usdRate: 0.012 },
      { currency: 'EUR', usdRate: 1.1 },
    ])
    .run();

  // Three ACTIVE employees in three countries + one INACTIVE (must be excluded).
  // Salaries are stored as minor units (cents/paise) of the listed currency.
  db.insert(employees)
    .values([
      // US: 100,000 USD = 10_000_000 cents
      {
        id: 'us-1',
        email: 'us1@example.com',
        country: 'US',
        salary: 10000000,
        currency: 'USD',
        ...baseRow,
      },
      // US: 80,000 USD = 8_000_000 cents
      {
        id: 'us-2',
        email: 'us2@example.com',
        country: 'US',
        salary: 8000000,
        currency: 'USD',
        ...baseRow,
      },
      // IN: 2,000,000 INR = 200_000_000 paise. Converted to USD cents:
      // 200_000_000 * 0.012 = 2_400_000 cents = 24,000 USD
      {
        id: 'in-1',
        email: 'in1@example.com',
        country: 'IN',
        salary: 200000000,
        currency: 'INR',
        ...baseRow,
      },
      // DE: 90,000 EUR = 9_000_000 cents → 9_000_000 * 1.1 = 9_900_000 cents = 99,000 USD
      {
        id: 'de-1',
        email: 'de1@example.com',
        country: 'DE',
        salary: 9000000,
        currency: 'EUR',
        ...baseRow,
      },
      // INACTIVE — must be excluded from headcount and payroll
      {
        id: 'us-x',
        email: 'usx@example.com',
        country: 'US',
        salary: 1000000,
        currency: 'USD',
        ...baseRow,
        status: 'INACTIVE',
      },
    ])
    .run();
}

describe('GET /insights/summary', () => {
  let app: Express;
  let db: DbConnection;
  let cookie: string;

  beforeEach(async () => {
    ({ app, db, cookie } = await buildApp());
    seedRosterAndRates(db);
  });

  it('returns 401 when called without authentication', async () => {
    const res = await request(app).get('/insights/summary');
    expect(res.status).toBe(401);
  });

  it('returns the response envelope shape', async () => {
    const res = await request(app).get('/insights/summary').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        totalHeadcount: expect.any(Number),
        totalPayrollUsd: expect.any(Number),
        headcountByCountry: expect.any(Array),
      }),
    );
  });

  it('counts only ACTIVE employees in totalHeadcount', async () => {
    const res = await request(app).get('/insights/summary').set('Cookie', cookie);
    expect(res.body.totalHeadcount).toBe(4); // 4 active, 1 inactive
  });

  it('sums salaries converted to USD cents using currency_rates', async () => {
    const res = await request(app).get('/insights/summary').set('Cookie', cookie);
    // 10_000_000 + 8_000_000 + (200_000_000 * 0.012) + (9_000_000 * 1.1)
    //   = 10_000_000 + 8_000_000 + 2_400_000 + 9_900_000
    //   = 30_300_000 USD cents = $303,000
    expect(res.body.totalPayrollUsd).toBe(30_300_000);
  });

  it('breaks down headcount by country (ACTIVE only)', async () => {
    const res = await request(app).get('/insights/summary').set('Cookie', cookie);
    const map = Object.fromEntries(
      res.body.headcountByCountry.map((row: { country: string; headcount: number }) => [
        row.country,
        row.headcount,
      ]),
    );
    expect(map).toEqual({ US: 2, IN: 1, DE: 1 });
  });

  it('orders headcountByCountry by headcount descending', async () => {
    const res = await request(app).get('/insights/summary').set('Cookie', cookie);
    const counts: number[] = res.body.headcountByCountry.map(
      (r: { headcount: number }) => r.headcount,
    );
    const sorted = [...counts].sort((a, b) => b - a);
    expect(counts).toEqual(sorted);
  });
});
