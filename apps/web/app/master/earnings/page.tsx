'use client';

import { useQuery } from '@tanstack/react-query';
import { PAYMENT_METHOD_INFO } from '@handly/contracts';
import { AppHeader } from '@/components/app-header';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ClipboardListIcon } from '@/components/ui/icons';
import { Logo } from '@/components/ui/logo';
import { formatSom } from '@/lib/format';
import { paymentsApi } from '@/lib/payments';
import { useRequireAuth } from '@/lib/use-require-auth';

/** Master's earnings history + revenue tracking (M5). */
export default function MasterEarningsPage() {
  const { ready, user } = useRequireAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['master', 'earnings'],
    queryFn: () => paymentsApi.getMasterEarnings(),
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

  const items = data?.items ?? [];

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
      <AppHeader backHref="/master" title="Daromad" />

      <div className="flex flex-1 flex-col gap-4 px-5 py-5">
        {isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <Alert>Daromadni yuklab bo&apos;lmadi</Alert>
            <Button variant="outline" onClick={() => void refetch()}>
              Qayta urinish
            </Button>
          </div>
        ) : isLoading || !data ? (
          <div className="flex flex-col gap-3">
            <div className="h-24 animate-pulse rounded-xl bg-background-secondary" />
            {Array.from({ length: 3 }).map((_, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={i} className="h-16 animate-pulse rounded-xl bg-background-secondary" />
            ))}
          </div>
        ) : (
          <>
            <div className="rounded-xl bg-ink p-5 text-center text-ink-fg">
              <p className="text-xs uppercase tracking-wide opacity-70">Jami daromad</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-primary">
                {formatSom(data.summary.totalNetAmount)}
              </p>
              <p className="mt-1 text-xs opacity-70">{data.summary.jobsPaid} ta to&apos;langan ish</p>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">
                Tranzaksiyalar
              </p>
              {items.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-border-tertiary bg-surface px-4 py-10 text-center shadow-card">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-background-secondary text-content-muted">
                    <ClipboardListIcon width={24} height={24} />
                  </span>
                  <p className="text-sm text-content-secondary">Hozircha to&apos;lovlar yo&apos;q</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {items.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl border border-border-tertiary bg-surface p-3.5 shadow-card"
                    >
                      <div>
                        <p className="text-sm font-medium text-content-primary">
                          {PAYMENT_METHOD_INFO[p.method].labelUz}
                        </p>
                        <p className="text-xs text-content-muted">
                          {p.succeededAt
                            ? new Date(p.succeededAt).toLocaleString('uz-UZ', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums text-content-primary">
                          {formatSom(p.masterNetAmount)}
                        </p>
                        <Badge variant="green" className="mt-0.5">
                          Sof daromad
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
