import { describe, expect, it } from 'vitest';
import { count, eq } from 'drizzle-orm';
import { seed } from '../src/seed/seed.js';
import { employees, users, currencyRates } from '../src/db/schema/index.js';
import { createTestDb } from './helpers/test-db.js';

describe('seed script', () => {
  it('inserts the requested number of employees', () => {
    const db = createTestDb();
    seed({ db, employeeCount: 100, randomSeed: 42 });

    const [{ value }] = db.select({ value: count() }).from(employees).all();
    expect(value).toBe(100);
  });

  it('is deterministic given the same random seed', () => {
    const dbA = createTestDb();
    const dbB = createTestDb();

    seed({ db: dbA, employeeCount: 200, randomSeed: 7 });
    seed({ db: dbB, employeeCount: 200, randomSeed: 7 });

    const rowsA = dbA
      .select()
      .from(employees)
      .orderBy(employees.id)
      .all()
      .map((r) => ({ ...r, createdAt: 0, updatedAt: 0 }));
    const rowsB = dbB
      .select()
      .from(employees)
      .orderBy(employees.id)
      .all()
      .map((r) => ({ ...r, createdAt: 0, updatedAt: 0 }));

    expect(rowsA).toEqual(rowsB);
  });

  it('produces different data when the random seed changes', () => {
    const dbA = createTestDb();
    const dbB = createTestDb();
    seed({ db: dbA, employeeCount: 100, randomSeed: 1 });
    seed({ db: dbB, employeeCount: 100, randomSeed: 2 });

    const firstEmailA = dbA.select().from(employees).limit(1).all()[0]?.email;
    const firstEmailB = dbB.select().from(employees).limit(1).all()[0]?.email;
    expect(firstEmailA).not.toBe(firstEmailB);
  });

  it('seeds a single HR admin user', () => {
    const db = createTestDb();
    seed({ db, employeeCount: 50, randomSeed: 42 });

    const rows = db.select().from(users).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe('hr@example.com');
    expect(rows[0]?.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('seeds currency rates including USD at 1.0', () => {
    const db = createTestDb();
    seed({ db, employeeCount: 50, randomSeed: 42 });

    const rates = db.select().from(currencyRates).all();
    expect(rates.length).toBeGreaterThan(1);

    const usd = db.select().from(currencyRates).where(eq(currencyRates.currency, 'USD')).all()[0];
    expect(usd?.usdRate).toBe(1);
  });

  it('is idempotent — running twice does not double rows', () => {
    const db = createTestDb();
    seed({ db, employeeCount: 50, randomSeed: 42 });
    seed({ db, employeeCount: 50, randomSeed: 42 });

    const [{ value: empCount }] = db.select({ value: count() }).from(employees).all();
    const [{ value: userCount }] = db.select({ value: count() }).from(users).all();
    expect(empCount).toBe(50);
    expect(userCount).toBe(1);
  });

  it('seeds 10,000 employees in under 5 seconds', () => {
    const db = createTestDb();
    const start = performance.now();
    seed({ db, employeeCount: 10_000, randomSeed: 42 });
    const elapsedMs = performance.now() - start;

    const [{ value }] = db.select({ value: count() }).from(employees).all();
    expect(value).toBe(10_000);
    expect(elapsedMs).toBeLessThan(5000);
  });
});
