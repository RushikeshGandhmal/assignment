import jwt from 'jsonwebtoken';

export interface AuthTokenPayload {
  sub: string;
  email: string;
}

const TOKEN_LIFETIME = '12h';

export function signAuthToken(payload: AuthTokenPayload, secret: string): string {
  return jwt.sign(payload, secret, { expiresIn: TOKEN_LIFETIME });
}

export function verifyAuthToken(token: string, secret: string): AuthTokenPayload {
  const decoded = jwt.verify(token, secret);
  if (typeof decoded === 'string' || !decoded.sub || !('email' in decoded)) {
    throw new Error('Invalid auth token payload');
  }
  return { sub: String(decoded.sub), email: String(decoded.email) };
}
