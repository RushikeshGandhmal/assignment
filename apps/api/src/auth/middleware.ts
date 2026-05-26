import type { NextFunction, Request, Response } from 'express';
import { verifyAuthToken } from './jwt.js';

export const AUTH_COOKIE_NAME = 'auth';

// Reads the auth cookie, verifies the JWT, and attaches the payload to req.user.
// Routes mounted behind this middleware are guaranteed an authenticated user.
export function requireAuth(jwtSecret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = req.cookies?.[AUTH_COOKIE_NAME];
    if (!token) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    try {
      req.user = verifyAuthToken(token, jwtSecret);
      next();
    } catch {
      res.status(401).json({ error: 'unauthenticated' });
    }
  };
}
