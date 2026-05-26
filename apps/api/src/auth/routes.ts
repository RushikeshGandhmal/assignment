import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { DbConnection } from '../db/client.js';
import { users } from '../db/schema/index.js';
import { signAuthToken } from './jwt.js';
import { verifyPassword } from './password.js';
import { AUTH_COOKIE_NAME, requireAuth } from './middleware.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const COOKIE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function createAuthRouter(deps: { db: DbConnection; jwtSecret: string }): Router {
  const router = Router();
  const { db, jwtSecret } = deps;

  router.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.flatten() });
      return;
    }
    const { email, password } = parsed.data;

    const user = db.select().from(users).where(eq(users.email, email)).limit(1).all()[0];
    if (!user) {
      // Use the same 401 message for missing user and bad password to avoid
      // leaking which emails are registered.
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }

    const token = signAuthToken({ sub: user.id, email: user.email }, jwtSecret);
    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: COOKIE_MAX_AGE_MS,
      path: '/',
    });
    res.json({ user: { id: user.id, email: user.email } });
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie(AUTH_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
    res.json({ ok: true });
  });

  router.get('/me', requireAuth(jwtSecret), (req, res) => {
    res.json({ id: req.user!.sub, email: req.user!.email });
  });

  return router;
}
