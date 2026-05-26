import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { apiGetMock, pushMock } = vi.hoisted(() => ({
  apiGetMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

vi.mock('@/lib/api', () => ({
  apiGet: apiGetMock,
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    body: unknown;
    constructor(status: number, body: unknown) {
      super(`API request failed with status ${status}`);
      this.name = 'ApiError';
      this.status = status;
      this.body = body;
    }
  },
}));

import { AuthGuard } from './auth-guard';
import { ApiError } from '@/lib/api';

beforeEach(() => {
  pushMock.mockReset();
  apiGetMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AuthGuard', () => {
  it('renders children once /auth/me resolves', async () => {
    apiGetMock.mockResolvedValue({ id: 'u1', email: 'hr@example.com' });

    render(
      <AuthGuard>
        <div>secret content</div>
      </AuthGuard>,
    );

    expect(await screen.findByText('secret content')).toBeInTheDocument();
    expect(apiGetMock).toHaveBeenCalledWith('/auth/me');
  });

  it('redirects to /login when /auth/me returns 401', async () => {
    apiGetMock.mockRejectedValue(new ApiError(401, { error: 'unauthorized' }));

    render(
      <AuthGuard>
        <div>secret content</div>
      </AuthGuard>,
    );

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/login'));
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('shows an inline error when the server is unreachable', async () => {
    apiGetMock.mockRejectedValue(new Error('network down'));

    render(
      <AuthGuard>
        <div>secret content</div>
      </AuthGuard>,
    );

    expect(await screen.findByText(/could not reach the server/i)).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('shows a loading indicator while the request is in flight', () => {
    apiGetMock.mockReturnValue(new Promise(() => {}));

    render(
      <AuthGuard>
        <div>secret content</div>
      </AuthGuard>,
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
