import { Router } from 'express';
import type { DbConnection } from '../db/client.js';
import { requireAuth } from '../auth/middleware.js';
import { InsightsService } from './service.js';

export function createInsightsRouter(deps: { db: DbConnection; jwtSecret: string }): Router {
  const router = Router();
  const service = new InsightsService(deps.db);

  router.use(requireAuth(deps.jwtSecret));

  router.get('/summary', (_req, res) => {
    res.json(service.getSummary());
  });

  return router;
}
