import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Salary Management</h1>
      <p className="text-muted-foreground">HR tooling for organizations at scale.</p>
      <Button>Get started</Button>
      <p className="text-sm text-muted-foreground">
        UI under construction — see project README for progress.
      </p>
    </main>
  );
}
