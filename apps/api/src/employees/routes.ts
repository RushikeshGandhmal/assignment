import { Router } from 'express';
import { createEmployeeSchema, listEmployeesQuerySchema } from '@salary-management/shared';
import type { DbConnection } from '../db/client.js';
import { requireAuth } from '../auth/middleware.js';
import { EmployeeService, EmployeeEmailConflictError } from './service.js';

export function createEmployeesRouter(deps: { db: DbConnection; jwtSecret: string }): Router {
  const router = Router();
  const service = new EmployeeService(deps.db);

  router.use(requireAuth(deps.jwtSecret));

  router.get('/', (req, res) => {
    const parsed = listEmployeesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.flatten() });
      return;
    }
    const result = service.listEmployees(parsed.data);
    res.json(result);
  });

  router.post('/', (req, res) => {
    const parsed = createEmployeeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.flatten() });
      return;
    }

    try {
      const employee = service.createEmployee(parsed.data);
      res.status(201).json(employee);
    } catch (err) {
      if (err instanceof EmployeeEmailConflictError) {
        res.status(409).json({ error: 'email_already_exists' });
        return;
      }
      throw err;
    }
  });

  return router;
}
