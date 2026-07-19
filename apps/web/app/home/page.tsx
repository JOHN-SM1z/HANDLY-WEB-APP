'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CheckIcon } from '@/components/ui/icons';
import { Logo } from '@/components/ui/logo';
import { api } from '@/lib/api';
import { authApi } from '@/lib/auth';
import { useSession } from '@/lib/session';
import { useRequireAuth } from '@/lib/use-require-auth';

interface MeResponse {
  id: string;
  phone: string;
  role: 'CUSTOMER' | 'MASTER' | 'ADMIN';
  status: string;
  referralCode: string;
}

const roleLabel: Record<MeResponse['role'], string> = {
  CUSTOMER: 'Mijoz',
  MASTER: 'Usta',
  ADMIN: 'Administrator',
};

export default function HomePage() {
  const { ready, user } = useRequireAuth();
  const router = useRouter();
  const clear = useSession((s) => s.clear);

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<MeResponse>('/me'),
    enabled: Boolean(user),
  });

  async function logout() {
    try {
      await authApi.logout();
    } finally {
      clear();
      router.replace('/login');
    }
  }

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
      <header className="flex items-center justify-between border-b border-border-tertiary px-5 py-4">
        <Logo size={30} withWordmark />
        <Button variant="ghost" size="sm" onClick={() => void logout()}>
          Chiqish
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-4 px-5 py-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-content-primary">
            Assalomu alaykum 👋
          </h1>
          <p className="mt-1 text-sm text-content-secondary">
            {me?.phone ?? user.phone} ·{' '}
            <span className="font-medium text-primary">{roleLabel[user.role]}</span>
          </p>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-border-tertiary bg-surface p-4 shadow-card">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-bg text-success-fg">
            <CheckIcon width={18} height={18} />
          </span>
          <div>
            <p className="text-sm font-medium text-content-primary">Hisobingiz tayyor</p>
            <p className="mt-0.5 text-sm text-content-secondary">
              Milestone 1 (autentifikatsiya va profil) muvaffaqiyatli o‘rnatildi. Keyingi
              bosqichlarda xizmatlar, buyurtmalar va to‘lovlar qo‘shiladi.
            </p>
          </div>
        </div>

        {me?.referralCode && (
          <div className="rounded-xl border border-border-tertiary bg-background-secondary p-4">
            <p className="text-xs uppercase tracking-wide text-content-muted">Referal kod</p>
            <p className="mt-1 font-mono text-lg font-semibold tracking-widest text-content-primary">
              {me.referralCode}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
