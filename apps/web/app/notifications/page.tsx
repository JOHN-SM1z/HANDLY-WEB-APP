'use client';

import { AppHeader } from '@/components/app-header';
import { BottomNav } from '@/components/nav/bottom-nav';
import { BellIcon } from '@/components/ui/icons';
import { Logo } from '@/components/ui/logo';
import { useRequireAuth } from '@/lib/use-require-auth';

export default function NotificationsPage() {
  const { ready, user } = useRequireAuth();

  if (!ready || !user) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <div className="animate-pulse">
          <Logo size={44} />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
      <AppHeader title="Bildirishnomalar" />
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-background-secondary text-content-muted">
          <BellIcon width={26} height={26} />
        </span>
        <p className="text-sm text-content-secondary">
          Hozircha bildirishnomalar yo&apos;q. Buyurtmangiz holati o&apos;zgarganda shu yerda
          ko&apos;rinadi.
        </p>
      </div>
      <BottomNav />
    </main>
  );
}
