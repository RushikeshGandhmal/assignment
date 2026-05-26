import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AuthGuard } from '@/components/auth-guard';
import { AppShell } from '@/components/app-shell';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
      <Toaster position="bottom-right" richColors closeButton />
    </AuthGuard>
  );
}
