import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { currencyRates, employees, users, type NewEmployee } from '../db/schema/index.js';
import type { DbConnection } from '../db/client.js';
import {
  COUNTRIES,
  CURRENCY_RATES,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  JOB_TITLES,
} from './reference-data.js';
import { createRng, intBetween, pick } from './rng.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SEED_DATA_DIR = resolve(HERE, '../../seed-data');

const ADMIN_EMAIL = 'hr@example.com';
const ADMIN_PASSWORD = 'changeme123';

// Insert in chunks. SQLite limits a single statement to 999 bound parameters,
// so chunkSize * columnsPerRow must stay under that.
const CHUNK_SIZE = 500;

export interface SeedOptions {
  db: DbConnection;
  employeeCount: number;
  randomSeed: number;
  firstNames?: string[];
  lastNames?: string[];
}

function readLines(path: string): string[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function seed(opts: SeedOptions): void {
  const { db, employeeCount, randomSeed } = opts;
  const firstNames = opts.firstNames ?? readLines(`${SEED_DATA_DIR}/first_names.txt`);
  const lastNames = opts.lastNames ?? readLines(`${SEED_DATA_DIR}/last_names.txt`);

  const rng = createRng(randomSeed);
  const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);

  // Generate all rows in memory first (cheap), then bulk insert in a single
  // transaction. The transaction wrapper turns ~10k commits into one fsync.
  const rows: NewEmployee[] = new Array(employeeCount);
  const usedEmails = new Set<string>();

  for (let i = 0; i < employeeCount; i++) {
    const first = pick(rng, firstNames);
    const last = pick(rng, lastNames);
    const country = pick(rng, COUNTRIES);
    const jobTitle = pick(rng, JOB_TITLES);
    const department = pick(rng, DEPARTMENTS);
    const employmentType = pick(rng, EMPLOYMENT_TYPES);
    const salary = intBetween(rng, country.salaryMinMinor, country.salaryMaxMinor);

    // Email must be unique; collisions are rare but possible with 10k draws.
    let suffix = i;
    let email = `${first}.${last}.${suffix}@example.com`.toLowerCase();
    while (usedEmails.has(email)) {
      suffix++;
      email = `${first}.${last}.${suffix}@example.com`.toLowerCase();
    }
    usedEmails.add(email);

    const daysAgo = intBetween(rng, 0, 365 * 10);
    const hireDate = new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);

    rows[i] = {
      id: `emp_${i.toString().padStart(7, '0')}`,
      firstName: first,
      lastName: last,
      email,
      jobTitle,
      department,
      country: country.code,
      salary,
      currency: country.currency,
      employmentType,
      hireDate,
      status: 'ACTIVE',
    };
  }

  // Wrap all writes in one transaction so partial failure rolls back cleanly
  // and we pay for one fsync, not 10k.
  db.transaction((tx) => {
    // Idempotency: clear target tables so re-running with the same seed
    // produces the same result rather than duplicating rows.
    tx.delete(employees).run();
    tx.delete(users).run();
    tx.delete(currencyRates).run();

    tx.insert(users).values({ id: 'usr_admin', email: ADMIN_EMAIL, passwordHash }).run();

    tx.insert(currencyRates).values(CURRENCY_RATES).run();

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      tx.insert(employees).values(chunk).run();
    }
  });
}
