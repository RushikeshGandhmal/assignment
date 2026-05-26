import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createDb, type DbConnection } from '../../src/db/client.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(here, '../../drizzle');

// Builds a fresh in-memory SQLite database with all migrations applied.
// Each test gets its own isolated instance — no cross-test state.
export function createTestDb(): DbConnection {
  const db = createDb({ file: ':memory:' });
  migrate(db, { migrationsFolder });
  return db;
}
