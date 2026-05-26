'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { apiPost } from '@/lib/api';
import { useCurrentUser } from './auth-context';

interface AppShellProps {
  children: ReactNode;
}

const NAV_ITEMS: { href: string; label: string }[] = [
  { href: '/', label: 'Dashboard' },
  { href: '/employees', label: 'Employees' },
];

export function AppShell({ children }: AppShellProps) {
  const user = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  async function onLogout() {
    setLoggingOut(true);
    try {
      await apiPost('/auth/logout', {});
    } catch {
      // Even if the request fails, force the user back to /login so they
      // do not get stuck in a half-logged-out state.
    } finally {
      router.push('/login');
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-base font-semibold tracking-tight">
              Salary Management
            </Link>
            <nav className="flex items-center gap-3 text-sm">
              {NAV_ITEMS.map((item) => {
                const active =
                  item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      active
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{user.email}</span>
            <Button variant="outline" size="sm" onClick={onLogout} disabled={loggingOut}>
              {loggingOut ? 'Signing out...' : 'Sign out'}
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
