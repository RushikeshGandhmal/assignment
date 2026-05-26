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

/**
 * Cookie options shared between login (set) and logout (clear). In production
 * the API and UI run on different sites (e.g. *.onrender.com and *.vercel.app),
 * so the auth cookie has to be SameSite=None + Secure for the browser to send
 * it on cross-site fetch calls. In development we stay on SameSite=Lax so the
 * cookie works over plain http://localhost.
 */
function authCookieOptions(): {
  httpOnly: true;
  sameSite: 'lax' | 'none';
  secure: boolean;
  path: '/';
} {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    path: '/',
  };
}

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
      ...authCookieOptions(),
      maxAge: COOKIE_MAX_AGE_MS,
    });
    res.json({ user: { id: user.id, email: user.email } });
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie(AUTH_COOKIE_NAME, authCookieOptions());
    res.json({ ok: true });
  });

  router.get('/me', requireAuth(jwtSecret), (req, res) => {
    res.json({ id: req.user!.sub, email: req.user!.email });
  });

  return router;
}
