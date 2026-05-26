'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api';
import { AuthContext, type CurrentUser } from './auth-context';

type GuardState =
  | { status: 'loading' }
  | { status: 'authed'; user: CurrentUser }
  | { status: 'redirecting' };

/**
 * Wraps protected routes. On mount, calls GET /auth/me. If the request
 * succeeds the children are rendered with the user available via
 * useCurrentUser(). On 401, the user is redirected to /login. Any other
 * failure renders a small inline error so the dashboard does not silently
 * stall on a broken backend.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<GuardState>({ status: 'loading' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<CurrentUser>('/auth/me')
      .then((user) => {
        if (!cancelled) setState({ status: 'authed', user });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setState({ status: 'redirecting' });
          router.push('/login');
        } else {
          setError('Could not reach the server. Please try again.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <div role="alert" className="flex min-h-screen items-center justify-center p-6 text-sm">
        {error}
      </div>
    );
  }

  if (state.status !== 'authed') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return <AuthContext.Provider value={state.user}>{children}</AuthContext.Provider>;
}
