import { existsSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema/index.js';

export type DbConnection = ReturnType<typeof drizzle<typeof schema>>;

export type CreateDbOptions = {
  /** Path to the SQLite file, or `:memory:` for an in-process DB. */
  file: string;
  /** Log every SQL statement. Off by default; useful for debugging tests. */
  verbose?: boolean;
};

// Opens a SQLite connection with sensible pragmas and returns a typed Drizzle client.
// Use this from the running server and from tests (with `:memory:`).
export function createDb({ file, verbose = false }: CreateDbOptions): DbConnection {
  if (file !== ':memory:') {
    const absolute = isAbsolute(file) ? file : resolve(process.cwd(), file);
    const dir = dirname(absolute);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  const sqlite = new Database(file, verbose ? { verbose: console.log } : undefined);

  // WAL gives much better read/write concurrency than the default rollback journal.
  sqlite.pragma('journal_mode = WAL');
  // SQLite does not enforce foreign keys unless asked to.
  sqlite.pragma('foreign_keys = ON');
  // If another process holds the write lock, wait up to 5s instead of failing immediately.
  sqlite.pragma('busy_timeout = 5000');

  return drizzle(sqlite, { schema });
}
