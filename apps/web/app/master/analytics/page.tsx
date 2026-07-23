'use client';

import { useQuery } from '@tanstack/react-query';
import { AppHeader } from '@/components/app-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { analyticsApi } from '@/lib/analytics';
import { formatSom } from '@/lib/format';
import { useRequireAuth } from '@/lib/use-require-auth';

const PLAN_LABEL: Record<string, string> = { FREE: 'Bepul', PREMIUM: 'Premium' };

/** Real-data-only master analytics (Batch 2) — no fake/demo values. */
export default function MasterAnalyticsPage() {
  const { ready, user } = useRequireAuth('MASTER');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['master', 'analytics'],
    queryFn: analyticsApi.getMine,
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
      <AppHeader backHref="/master" title="Statistika" />

      <div className="flex flex-1 flex-col gap-3 px-5 py-5">
        {isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <Alert>Statistikani yuklab bo&apos;lmadi</Alert>
            <Button variant="outline" onClick={() => void refetch()}>
              Qayta urinish
            </Button>
          </div>
        ) : isLoading || !data ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={i} className="h-16 animate-pulse rounded-xl bg-background-secondary" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border-tertiary bg-surface p-4 shadow-card">
                <p className="text-2xl font-bold tabular-nums text-content-primary">{data.jobsDone}</p>
                <p className="mt-0.5 text-xs text-content-muted">Bajarilgan ishlar</p>
              </div>
              <div className="rounded-xl border border-border-tertiary bg-surface p-4 shadow-card">
                <p className="text-2xl font-bold tabular-nums text-content-primary">{data.ratingAvg.toFixed(2)}</p>
                <p className="mt-0.5 text-xs text-content-muted">
                  Reyting
                  {data.ratingTrendDelta !== 0 && (
                    <span className={data.ratingTrendDelta > 0 ? 'text-success-fg' : 'text-danger-fg'}>
                      {' '}
                      {data.ratingTrendDelta > 0 ? '↑' : '↓'} {Math.abs(data.ratingTrendDelta).toFixed(2)}
                    </span>
                  )}
                </p>
              </div>
              <div className="rounded-xl border border-border-tertiary bg-surface p-4 shadow-card">
                <p className="text-2xl font-bold tabular-nums text-content-primary">
                  {Math.round(data.responseRate * 100)}%
                </p>
                <p className="mt-0.5 text-xs text-content-muted">Javob berish darajasi</p>
              </div>
              <div className="rounded-xl border border-border-tertiary bg-surface p-4 shadow-card">
                <p className="text-2xl font-bold tabular-nums text-primary">T{data.trustTier}</p>
                <p className="mt-0.5 text-xs text-content-muted">Ishonch darajasi ({data.trustScore}/100)</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border-tertiary bg-surface p-4 shadow-card">
              <div>
                <p className="text-sm font-medium text-content-primary">Obuna</p>
                <p className="text-xs text-content-muted">Joriy reja</p>
              </div>
              <Badge variant={data.subscriptionPlan === 'PREMIUM' ? 'green' : 'gray'}>
                {PLAN_LABEL[data.subscriptionPlan] ?? data.subscriptionPlan}
              </Badge>
            </div>

            <div className="rounded-xl bg-ink p-5 text-center text-ink-fg">
              <p className="text-xs uppercase tracking-wide opacity-70">Jami daromad</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-primary">
                {formatSom(data.earnings.totalNetAmount)}
              </p>
              <p className="mt-1 text-xs opacity-70">{data.earnings.jobsPaid} ta to&apos;langan ish</p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
