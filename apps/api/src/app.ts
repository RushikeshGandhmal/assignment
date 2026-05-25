import express, { type Express } from 'express';

import { healthRouter } from './routes/health.js';

/**
 * Creates and configures the Express application.
 *
 * Separated from the server entry point so the app can be imported
 * directly in tests (via supertest) without binding to a port.
 */
export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.use('/health', healthRouter);

  return app;
}
