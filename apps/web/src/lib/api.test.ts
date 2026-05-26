import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from './api';

const ORIGINAL_FETCH = global.fetch;

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

function mockFetch(responses: Response | Response[]): ReturnType<typeof vi.fn> {
  const queue = Array.isArray(responses) ? [...responses] : [responses];
  const fn = vi.fn(async () => queue.shift() ?? new Response(null, { status: 500 }));
  global.fetch = fn as unknown as typeof global.fetch;
  return fn;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('api client', () => {
  it('apiGet builds a URL against NEXT_PUBLIC_API_URL and returns parsed JSON', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://api.test';
    const fetchMock = mockFetch(jsonResponse({ status: 'ok' }));

    const data = await apiGet<{ status: string }>('/health');

    expect(data).toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://api.test/health');
    expect(init).toMatchObject({ method: 'GET', credentials: 'include' });
  });

  it('apiPost sends a JSON body with the correct headers and method', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://api.test';
    const fetchMock = mockFetch(jsonResponse({ ok: true }, 201));

    const data = await apiPost<{ ok: boolean }>('/employees', { firstName: 'A' });

    expect(data).toEqual({ ok: true });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ firstName: 'A' });
  });

  it('apiPatch sends a JSON body with method PATCH', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://api.test';
    const fetchMock = mockFetch(jsonResponse({ ok: true }));

    await apiPatch('/employees/abc', { firstName: 'B' });

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init).toMatchObject({ method: 'PATCH' });
  });

  it('apiDelete uses DELETE and returns undefined for a 204 response', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://api.test';
    const fetchMock = mockFetch(new Response(null, { status: 204 }));

    const data = await apiDelete('/employees/abc');

    expect(data).toBeUndefined();
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init).toMatchObject({ method: 'DELETE' });
  });

  it('throws ApiError on a non-2xx response with the parsed body', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://api.test';
    mockFetch(jsonResponse({ error: 'not_found' }, 404));

    try {
      await apiGet('/employees/missing');
      expect.fail('expected ApiError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(404);
      expect(apiErr.body).toEqual({ error: 'not_found' });
    }
  });

  it('ApiError exposes status and body and has a useful message', async () => {
    const err = new ApiError(400, { error: 'invalid_body' });
    expect(err.status).toBe(400);
    expect(err.body).toEqual({ error: 'invalid_body' });
    expect(err.message).toContain('400');
  });

  it('falls back to localhost:4000 when NEXT_PUBLIC_API_URL is not set', async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    const fetchMock = mockFetch(jsonResponse({ status: 'ok' }));

    await apiGet('/health');

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:4000/health');
  });
});
