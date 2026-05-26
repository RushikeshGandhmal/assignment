import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './page';
import { ApiError } from '@/lib/api';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

const apiPostMock = vi.fn();
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiPost: (...args: unknown[]) => apiPostMock(...args) };
});

beforeEach(() => {
  pushMock.mockReset();
  apiPostMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('LoginPage', () => {
  it('renders email, password, and submit controls', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('submits credentials to /auth/login and redirects on success', async () => {
    apiPostMock.mockResolvedValueOnce({ user: { id: 'u1', email: 'hr@example.com' } });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'hr@example.com');
    await user.type(screen.getByLabelText(/password/i), 'changeme123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/auth/login', {
        email: 'hr@example.com',
        password: 'changeme123',
      });
    });
    expect(pushMock).toHaveBeenCalledWith('/');
  });

  it('shows an error message when credentials are rejected', async () => {
    apiPostMock.mockRejectedValueOnce(new ApiError(401, { error: 'invalid_credentials' }));
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'hr@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('disables the submit button while the request is in flight', async () => {
    let resolveLogin: (value: unknown) => void = () => {};
    apiPostMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'hr@example.com');
    await user.type(screen.getByLabelText(/password/i), 'changeme123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    const button = screen.getByRole('button', { name: /signing in/i });
    expect(button).toBeDisabled();

    resolveLogin({ user: { id: 'u1', email: 'hr@example.com' } });
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/'));
  });

  it('shows a generic error when the server returns an unexpected failure', async () => {
    apiPostMock.mockRejectedValueOnce(new ApiError(500, { error: 'oops' }));
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'hr@example.com');
    await user.type(screen.getByLabelText(/password/i), 'changeme123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
  });
});
