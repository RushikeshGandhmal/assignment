import type { AuthTokenPayload } from './jwt.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthTokenPayload;
  }
}
