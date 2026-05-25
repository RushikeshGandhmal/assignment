import { Router } from 'express';

/**
 * Health check endpoint.
 * Used by load balancers, CI, and monitoring to verify the service is alive.
 */
export const healthRouter: Router = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok' });
});
