'use client';

import { useQuery } from '@tanstack/react-query';
import { AppHeader } from '@/components/app-header';
import { OrderStatusBadge } from '@/components/order/order-status-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ClipboardListIcon } from '@/components/ui/icons';
import { Logo } from '@/components/ui/logo';
import { formatSom } from '@/lib/format';
import { masterApi } from '@/lib/master';
import { useRequireAuth } from '@/lib/use-require-auth';

/** Master's own resolved (COMPLETED/CLOSED) job history (M4). */
export default function MasterJobHistoryPage() {
  const { ready, user } = useRequireAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['master', 'jobs'],
    queryFn: () => masterApi.getJobHistory(),
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

  const jobs = data?.items ?? [];

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
      <AppHeader backHref="/master" title="Ish tarixi" />

      <div className="flex flex-1 flex-col gap-3 px-5 py-5">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="h-20 animate-pulse rounded-xl bg-background-secondary" />
          ))
        ) : isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <Alert>Ish tarixini yuklab bo&apos;lmadi</Alert>
            <Button variant="outline" onClick={() => void refetch()}>
              Qayta urinish
            </Button>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-background-secondary text-content-muted">
              <ClipboardListIcon width={26} height={26} />
            </span>
            <p className="text-sm text-content-secondary">Hozircha bajarilgan ish yo&apos;q</p>
          </div>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              className="flex flex-col gap-2 rounded-xl border border-border-tertiary bg-surface p-4 shadow-card"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-content-primary">
                  {job.categoryName ?? 'Xizmat'} #{job.orderNo}
                </span>
                <OrderStatusBadge status={job.status} />
              </div>
              <p className="line-clamp-1 text-xs text-content-secondary">{job.description}</p>
              {job.finalAmount != null && (
                <p className="text-xs font-medium tabular-nums text-content-primary">
                  {formatSom(job.finalAmount)}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </main>
  );
}
