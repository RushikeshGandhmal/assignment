/**
 * Thin typed fetch wrapper used by the UI to call the Express API.
 *
 * - credentials: 'include' so the httpOnly auth cookie is sent on every call
 * - Non-2xx responses throw ApiError carrying { status, body } for the UI to
 *   discriminate (401 -> redirect to login, 409 -> show inline validation, ...)
 * - 204 returns undefined; other JSON responses are parsed via response.json()
 */

const DEFAULT_BASE_URL = 'http://localhost:4000';

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_BASE_URL;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`API request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    credentials: 'include',
    ...init,
  });

  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function apiDelete<T = void>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}
