'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/app-header';
import { BottomNav } from '@/components/nav/bottom-nav';
import { SupportContacts } from '@/components/support-contacts';
import { Button } from '@/components/ui/button';
import { ChevronRightIcon, ClipboardListIcon } from '@/components/ui/icons';
import { Logo } from '@/components/ui/logo';
import { api } from '@/lib/api';
import { authApi } from '@/lib/auth';
import { useSession } from '@/lib/session';
import { useRequireAuth } from '@/lib/use-require-auth';

interface MeResponse {
  phone: string;
  role: 'CUSTOMER' | 'MASTER' | 'ADMIN';
  referralCode: string;
}

const roleLabel: Record<MeResponse['role'], string> = {
  CUSTOMER: 'Mijoz',
  MASTER: 'Usta',
  ADMIN: 'Administrator',
};

export default function ProfilePage() {
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
      <AppHeader title="Profil" />

      <div className="flex flex-1 flex-col gap-5 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-soft-fg">
            {(me?.phone ?? user.phone).slice(-2)}
          </div>
          <div>
            <p className="text-sm font-medium text-content-primary">
              {me?.phone ?? user.phone}
            </p>
            <p className="text-sm text-primary">{roleLabel[user.role]}</p>
          </div>
        </div>

        <Link
          href="/orders"
          className="flex items-center gap-3 rounded-xl border border-border-tertiary bg-surface px-4 py-3 shadow-card"
        >
          <ClipboardListIcon width={18} height={18} className="text-primary" />
          <span className="flex-1 text-sm font-medium text-content-primary">
            Buyurtmalar tarixi
          </span>
          <ChevronRightIcon width={16} height={16} className="text-content-muted" />
        </Link>

        {user.role === 'MASTER' && (
          <>
            <Link
              href="/master"
              className="flex items-center gap-3 rounded-xl border border-border-tertiary bg-surface px-4 py-3 shadow-card"
            >
              <span className="flex-1 text-sm font-medium text-content-primary">Usta paneli</span>
              <ChevronRightIcon width={16} height={16} className="text-content-muted" />
            </Link>
            <Link
              href="/master/jobs"
              className="flex items-center gap-3 rounded-xl border border-border-tertiary bg-surface px-4 py-3 shadow-card"
            >
              <span className="flex-1 text-sm font-medium text-content-primary">Ish tarixi</span>
              <ChevronRightIcon width={16} height={16} className="text-content-muted" />
            </Link>
            <Link
              href="/master/earnings"
              className="flex items-center gap-3 rounded-xl border border-border-tertiary bg-surface px-4 py-3 shadow-card"
            >
              <span className="flex-1 text-sm font-medium text-content-primary">Daromad</span>
              <ChevronRightIcon width={16} height={16} className="text-content-muted" />
            </Link>
            <Link
              href="/master/analytics"
              className="flex items-center gap-3 rounded-xl border border-border-tertiary bg-surface px-4 py-3 shadow-card"
            >
              <span className="flex-1 text-sm font-medium text-content-primary">Statistika</span>
              <ChevronRightIcon width={16} height={16} className="text-content-muted" />
            </Link>
          </>
        )}

        <Link
          href="/referrals"
          className="flex items-center gap-3 rounded-xl border border-border-tertiary bg-background-secondary px-4 py-3 shadow-card"
        >
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wide text-content-muted">Referal kod</p>
            {me?.referralCode && (
              <p className="mt-0.5 font-mono text-base font-semibold tracking-widest text-content-primary">
                {me.referralCode}
              </p>
            )}
          </div>
          <ChevronRightIcon width={16} height={16} className="text-content-muted" />
        </Link>

        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">
            Yordam
          </h2>
          <div className="flex flex-col gap-2">
            <Link
              href="/help"
              className="flex items-center gap-3 rounded-xl border border-border-tertiary bg-surface px-4 py-3 shadow-card"
            >
              <span className="flex-1 text-sm font-medium text-content-primary">
                Yordam markazi
              </span>
              <ChevronRightIcon width={16} height={16} className="text-content-muted" />
            </Link>
            <div className="rounded-xl border border-border-tertiary bg-surface px-4 py-3 shadow-card">
              <p className="mb-1.5 text-sm font-medium text-content-primary">
                Biz bilan bog&apos;lanish
              </p>
              <SupportContacts />
            </div>
          </div>
        </section>

        <Button variant="outline" onClick={() => void logout()} className="mt-auto">
          Chiqish
        </Button>
      </div>

      <BottomNav />
    </main>
  );
}
