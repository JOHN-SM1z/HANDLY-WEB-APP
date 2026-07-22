'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { StatCard } from '@/components/admin/stat-card';
import { AppHeader } from '@/components/app-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ChevronRightIcon } from '@/components/ui/icons';
import { Logo } from '@/components/ui/logo';
import { adminApi } from '@/lib/admin';
import { formatSom } from '@/lib/format';
import { Role } from '@handly/contracts';
import { useRequireAuth } from '@/lib/use-require-auth';

const SECTIONS = [
  { href: '/admin/orders', label: 'Buyurtmalar' },
  { href: '/admin/customers', label: 'Mijozlar' },
  { href: '/admin/masters', label: 'Ustalar' },
  { href: '/admin/verifications', label: "Tasdiqlash so'rovlari" },
  { href: '/admin/guarantee-claims', label: 'Kafolat soʻoroqlari' },
  { href: '/admin/analytics', label: 'Statistika' },
  { href: '/admin/audit-log', label: 'Amallar tarixi' },
  { href: '/admin/feature-flags', label: 'Funksiya bayroqlari' },
  { href: '/admin/support', label: "Qo'llab-quvvatlash" },
];

export default function AdminOverviewPage() {
  const { ready, user } = useRequireAuth(Role.ADMIN);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'analytics', 'overview'],
    queryFn: () => adminApi.analytics.overview(),
    enabled: Boolean(user),
  });

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
      <AppHeader title="Admin panel" backHref="/profile" />

      <div className="flex flex-1 flex-col gap-5 px-5 py-5">
        {isError ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Alert>Statistikani yuklab bo&apos;lmadi</Alert>
            <Button variant="outline" onClick={() => void refetch()}>
              Qayta urinish
            </Button>
          </div>
        ) : isLoading || !data ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={i} className="h-20 animate-pulse rounded-xl bg-background-secondary" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Yaratilgan buyurtmalar" value={data.ordersCreated} />
            <StatCard label="Yakunlangan" value={data.ordersCompleted} />
            <StatCard label="Faol ustalar" value={data.activeMasters} />
            <StatCard label="Faol mijozlar" value={data.activeCustomers} />
            <StatCard label="Daromad" value={formatSom(data.revenueTotal)} />
            <StatCard
              label="Mijoz mamnuniyati"
              value={data.customerSatisfactionAvg != null ? data.customerSatisfactionAvg.toFixed(2) : '—'}
            />
          </div>
        )}

        <nav className="flex flex-col gap-2" aria-label="Admin bo'limlari">
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="flex items-center gap-3 rounded-xl border border-border-tertiary bg-surface px-4 py-3 shadow-card"
            >
              <span className="flex-1 text-sm font-medium text-content-primary">{s.label}</span>
              <ChevronRightIcon width={16} height={16} className="text-content-muted" />
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
