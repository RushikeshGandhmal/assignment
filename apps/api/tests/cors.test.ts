import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createTestDb } from './helpers/test-db.js';

describe('CORS', () => {
  const allowedOrigin = 'http://localhost:3000';
  const otherOrigin = 'http://evil.example.com';

  function buildApp() {
    return createApp({
      db: createTestDb(),
      jwtSecret: 'test-secret-at-least-16-chars',
      corsOrigin: allowedOrigin,
    });
  }

  it('responds to a preflight from the allowed origin with credentials', async () => {
    const res = await request(buildApp())
      .options('/auth/login')
      .set('Origin', allowedOrigin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('attaches CORS headers on actual requests from the allowed origin', async () => {
    const res = await request(buildApp()).get('/health').set('Origin', allowedOrigin);

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not echo an unknown origin back in the allow-origin header', async () => {
    const res = await request(buildApp()).get('/health').set('Origin', otherOrigin);

    // cors() with an array allow-list omits the header rather than echoing
    // the unknown origin, which is what the browser enforces against.
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
