import { env } from '../env.js';
import { createDb, type DbConnection } from './client.js';

// Singleton DB connection used by the running Express server.
// Tests build their own isolated `createDb({ file: ':memory:' })` instance.
export const db: DbConnection = createDb({ file: env.DATABASE_FILE });
