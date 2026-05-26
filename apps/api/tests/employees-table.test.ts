import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { employees } from '../src/db/schema/employees.js';
import { createTestDb } from './helpers/test-db.js';

type Db = ReturnType<typeof createTestDb>;

const baseEmployee = {
  id: 'emp_01',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  jobTitle: 'Software Engineer',
  department: 'Engineering',
  country: 'GB',
  salary: 12_000_000, // 120,000.00 in minor units
  currency: 'GBP',
  employmentType: 'FULL_TIME' as const,
  hireDate: '2020-01-15',
};

describe('employees table', () => {
  let db: Db;

  beforeEach(() => {
    db = createTestDb();
  });

  it('stores an employee and reads it back with every column', () => {
    db.insert(employees).values(baseEmployee).run();

    const rows = db.select().from(employees).all();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject(baseEmployee);
    expect(rows[0]?.status).toBe('ACTIVE');
    expect(rows[0]?.createdAt).toBeTypeOf('number');
    expect(rows[0]?.updatedAt).toBeTypeOf('number');
  });

  it('defaults status to ACTIVE when not supplied', () => {
    db.insert(employees).values(baseEmployee).run();
    const [row] = db.select().from(employees).all();
    expect(row?.status).toBe('ACTIVE');
  });

  it('enforces unique email across employees', () => {
    db.insert(employees).values(baseEmployee).run();
    expect(() =>
      db
        .insert(employees)
        .values({ ...baseEmployee, id: 'emp_02' })
        .run(),
    ).toThrow(/UNIQUE/i);
  });

  it('rejects rows missing required columns', () => {
    expect(() =>
      db
        .insert(employees)
        // @ts-expect-error intentionally missing required fields
        .values({ id: 'emp_03' })
        .run(),
    ).toThrow(/NOT NULL/i);
  });

  it('indexes country, job_title, and status for insights queries', () => {
    const indexes = db.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'employees'`,
    );
    const names = indexes.map((i) => i.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'employees_country_idx',
        'employees_job_title_idx',
        'employees_status_idx',
        'employees_country_job_title_idx',
      ]),
    );
  });
});
