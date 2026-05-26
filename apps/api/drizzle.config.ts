import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  // List each schema file explicitly so drizzle-kit does not try to load the
  // ESM barrel (its CJS loader cannot resolve the .js extension on .ts files).
  schema: ['./src/db/schema/employees.ts'],
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_FILE ?? './data/salary-management.db',
  },
  strict: true,
  verbose: true,
});
