import { z } from 'zod';

// Parses and validates environment variables exactly once at process start.
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_FILE: z.string().min(1).default('./data/salary-management.db'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
