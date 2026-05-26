import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { apiPostMock, pushMock, pathnameMock } = vi.hoisted(() => ({
  apiPostMock: vi.fn(),
  pushMock: vi.fn(),
  pathnameMock: vi.fn(() => '/'),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
  usePathname: () => pathnameMock(),
}));

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: apiPostMock,
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

import { AppShell } from './app-shell';
import { AuthContext } from './auth-context';

function renderShell() {
  return render(
    <AuthContext.Provider value={{ id: 'u1', email: 'hr@example.com' }}>
      <AppShell>
        <div>inner content</div>
      </AppShell>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  pushMock.mockReset();
  apiPostMock.mockReset();
  pathnameMock.mockReturnValue('/');
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AppShell', () => {
  it('renders the children and the current user email', () => {
    renderShell();
    expect(screen.getByText('inner content')).toBeInTheDocument();
    expect(screen.getByText('hr@example.com')).toBeInTheDocument();
  });

  it('renders Dashboard and Employees navigation links', () => {
    renderShell();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Employees' })).toHaveAttribute('href', '/employees');
  });

  it('calls /auth/logout and pushes to /login when the user signs out', async () => {
    apiPostMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: /sign out/i }));

    await waitFor(() => expect(apiPostMock).toHaveBeenCalledWith('/auth/logout', {}));
    expect(pushMock).toHaveBeenCalledWith('/login');
  });

  it('still navigates to /login if the logout request fails', async () => {
    apiPostMock.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: /sign out/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/login'));
  });
});
