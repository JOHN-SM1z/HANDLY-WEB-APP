'use client';

import { useQuery } from '@tanstack/react-query';
import { AppHeader } from '@/components/app-header';
import { StatCard } from '@/components/admin/stat-card';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { Role } from '@handly/contracts';
import { adminApi } from '@/lib/admin';
import { formatSom } from '@/lib/format';
import { useRequireAuth } from '@/lib/use-require-auth';

function formatSeconds(s: number | null): string {
  if (s === null) return '—';
  if (s < 60) return `${Math.round(s)} s`;
  if (s < 3600) return `${Math.round(s / 60)} daq`;
  return `${(s / 3600).toFixed(1)} soat`;
}

export default function AdminAnalyticsPage() {
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
      <AppHeader title="Statistika" backHref="/admin" />

      <div className="flex flex-1 flex-col gap-5 px-5 py-5">
        {isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <Alert>Statistikani yuklab bo&apos;lmadi</Alert>
            <Button variant="outline" onClick={() => void refetch()}>
              Qayta urinish
            </Button>
          </div>
        ) : isLoading || !data ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={i} className="h-20 animate-pulse rounded-xl bg-background-secondary" />
            ))}
          </div>
        ) : (
          <>
            <section>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">Buyurtmalar</h2>
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Yaratilgan" value={data.ordersCreated} />
                <StatCard label="Yakunlangan" value={data.ordersCompleted} />
                <StatCard label="Bekor qilingan" value={data.ordersCancelled} />
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">Marketplace</h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Faol ustalar" value={data.activeMasters} />
                <StatCard label="Faol mijozlar" value={data.activeCustomers} />
                <StatCard label="Daromad" value={formatSom(data.revenueTotal)} />
                <StatCard
                  label="Mijoz mamnuniyati"
                  value={data.customerSatisfactionAvg != null ? data.customerSatisfactionAvg.toFixed(2) : '—'}
                />
                <StatCard label="O'rtacha javob vaqti" value={formatSeconds(data.avgResponseTimeSeconds)} />
                <StatCard label="O'rtacha bajarish vaqti" value={formatSeconds(data.avgCompletionTimeSeconds)} />
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">
                Tasdiqlash holati
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Tasdiqlanmagan" value={data.verificationStats.unverified} />
                <StatCard label="Kutilmoqda" value={data.verificationStats.pending} />
                <StatCard label="Tasdiqlangan" value={data.verificationStats.verified} />
                <StatCard label="Rad etilgan" value={data.verificationStats.rejected} />
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">Obunalar</h2>
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Free" value={data.subscriptionStats.free} />
                <StatCard label="Premium" value={data.subscriptionStats.premium} />
                <StatCard label="Sinov muddati" value={data.subscriptionStats.trial} />
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">
                Cashback va referal
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Jami cashback" value={formatSom(data.cashbackStats.totalAmount)} />
                <StatCard label="Cashback yozuvlari" value={data.cashbackStats.recordCount} />
                <StatCard label="Referal: faol" value={data.referralStats.active} />
                <StatCard label="Referal: mukofotlangan" value={data.referralStats.rewarded} />
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
