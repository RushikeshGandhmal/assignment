import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_FILE ?? './data/salary-management.db',
  },
  strict: true,
  verbose: true,
});
