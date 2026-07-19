'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Logo } from '@/components/ui/logo';
import { useSession } from '@/lib/session';

export default function IndexPage() {
  const router = useRouter();
  const ready = useSession((s) => s.ready);
  const user = useSession((s) => s.user);

  useEffect(() => {
    if (!ready) return;
    router.replace(user ? '/home' : '/login');
  }, [ready, user, router]);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center">
      <div className="animate-pulse">
        <Logo size={48} withWordmark />
      </div>
    </main>
  );
}
