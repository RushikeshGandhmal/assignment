import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import type { DbConnection } from './db/client.js';
import { createAuthRouter } from './auth/routes.js';
import { createEmployeesRouter } from './employees/routes.js';
import { createInsightsRouter } from './insights/routes.js';
import { healthRouter } from './routes/health.js';

export interface AppDeps {
  db: DbConnection;
  jwtSecret: string;
}

// Builds the Express app from explicit dependencies. Tests pass in an
// in-memory DB and a fixed secret; the server entry passes the configured
// singleton db and env.JWT_SECRET.
export function createApp(deps: AppDeps): Express {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  app.use('/health', healthRouter);
  app.use('/auth', createAuthRouter(deps));
  app.use('/employees', createEmployeesRouter(deps));
  app.use('/insights', createInsightsRouter(deps));

  return app;
}
