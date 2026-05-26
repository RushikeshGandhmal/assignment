import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { createTestDb } from './helpers/test-db.js';

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const app = createApp({ db: createTestDb(), jwtSecret: 'test-secret-1234567890' });

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
