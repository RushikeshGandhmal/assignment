import { Router } from 'express';
import { countryCodeSchema } from '@salary-management/shared';
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

  router.get('/countries/:country', (req, res) => {
    const parsed = countryCodeSchema.safeParse(req.params.country);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_country', details: parsed.error.flatten() });
      return;
    }

    const insights = service.getCountryInsights(parsed.data);
    if (!insights) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    res.json(insights);
  });

  return router;
}
