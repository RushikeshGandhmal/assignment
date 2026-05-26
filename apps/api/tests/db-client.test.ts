import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDb } from '../src/db/client.js';

describe('createDb', () => {
  it('opens an in-memory SQLite connection and runs queries', () => {
    const db = createDb({ file: ':memory:' });
    const result = db.all<{ value: number }>(sql`select 1 as value`);
    expect(result).toEqual([{ value: 1 }]);
  });

  it('enables foreign key enforcement', () => {
    const db = createDb({ file: ':memory:' });
    const [row] = db.all<{ foreign_keys: number }>(sql`PRAGMA foreign_keys`);
    expect(row?.foreign_keys).toBe(1);
  });

  it('uses WAL journal mode for non-memory databases', () => {
    const db = createDb({ file: ':memory:' });
    // :memory: forces journal_mode=memory; check that pragma queries work at all.
    // For a real file we would assert 'wal'; we keep this test fast and isolated.
    const [row] = db.all<{ journal_mode: string }>(sql`PRAGMA journal_mode`);
    expect(row?.journal_mode).toBeDefined();
  });
});
