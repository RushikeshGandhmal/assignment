import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import type { DbConnection } from './db/client.js';
import { createAuthRouter } from './auth/routes.js';
import { createEmployeesRouter } from './employees/routes.js';
import { createInsightsRouter } from './insights/routes.js';
import { healthRouter } from './routes/health.js';

export interface AppDeps {
  db: DbConnection;
  jwtSecret: string;
  /**
   * Comma-separated list of allowed origins for CORS. The UI runs on a
   * different port in dev (3000 vs 4000), so the browser treats every
   * call as cross-origin and requires explicit allow-list + credentials.
   */
  corsOrigin?: string;
}

// Builds the Express app from explicit dependencies. Tests pass in an
// in-memory DB and a fixed secret; the server entry passes the configured
// singleton db and env.JWT_SECRET.
export function createApp(deps: AppDeps): Express {
  const app = express();

  const allowedOrigins = (deps.corsOrigin ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  app.use('/health', healthRouter);
  app.use('/auth', createAuthRouter(deps));
  app.use('/employees', createEmployeesRouter(deps));
  app.use('/insights', createInsightsRouter(deps));

  return app;
}
