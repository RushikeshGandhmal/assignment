import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { env } from '../env.js';
import { createDb } from './client.js';

// Applies any pending SQL migrations from the `drizzle/` folder.
// Safe to run on every startup: drizzle tracks applied migrations in a journal table.
const db = createDb({ file: env.DATABASE_FILE });
migrate(db, { migrationsFolder: './drizzle' });

console.log(`Migrations applied to ${env.DATABASE_FILE}`);
