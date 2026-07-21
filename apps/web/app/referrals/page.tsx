'use client';

import { useQuery } from '@tanstack/react-query';
import { AppHeader } from '@/components/app-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardListIcon } from '@/components/ui/icons';
import { Logo } from '@/components/ui/logo';
import { formatSom } from '@/lib/format';
import { referralsApi } from '@/lib/referrals';
import { useRequireAuth } from '@/lib/use-require-auth';

const REFERRAL_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Ro\'yxatdan o\'tdi',
  ACTIVE: 'Faol',
  REWARDED: 'Mukofotlandi',
};

/** Referral code + cashback history (Batch 2 growth foundation). */
export default function ReferralsPage() {
  const { ready, user } = useRequireAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['me', 'referrals'],
    queryFn: referralsApi.getSummary,
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
      <AppHeader backHref="/profile" title="Referal dasturi" />

      <div className="flex flex-1 flex-col gap-4 px-5 py-5">
        {isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <Alert>Ma&apos;lumotlarni yuklab bo&apos;lmadi</Alert>
            <Button variant="outline" onClick={() => void refetch()}>
              Qayta urinish
            </Button>
          </div>
        ) : isLoading || !data ? (
          <div className="flex flex-col gap-3">
            <div className="h-28 animate-pulse rounded-xl bg-background-secondary" />
            {Array.from({ length: 2 }).map((_, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={i} className="h-16 animate-pulse rounded-xl bg-background-secondary" />
            ))}
          </div>
        ) : (
          <>
            <div className="rounded-xl bg-ink p-5 text-center text-ink-fg">
              <p className="text-xs uppercase tracking-wide opacity-70">Sizning kodingiz</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-primary">
                {data.referralCode}
              </p>
              <p className="mt-2 text-xs opacity-70">
                Do&apos;stlaringiz ro&apos;yxatdan o&apos;tganda ushbu kodni kiritsin
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border-tertiary bg-surface p-4 text-center shadow-card">
                <p className="text-xl font-bold tabular-nums text-content-primary">{data.totalReferred}</p>
                <p className="mt-0.5 text-xs text-content-muted">Taklif qilinganlar</p>
              </div>
              <div className="rounded-xl border border-border-tertiary bg-surface p-4 text-center shadow-card">
                <p className="text-xl font-bold tabular-nums text-primary">
                  {formatSom(data.totalCashbackEarned)}
                </p>
                <p className="mt-0.5 text-xs text-content-muted">Jami cashback</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">
                Takliflar
              </p>
              {data.referrals.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-border-tertiary bg-surface px-4 py-10 text-center shadow-card">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-background-secondary text-content-muted">
                    <ClipboardListIcon width={24} height={24} />
                  </span>
                  <p className="text-sm text-content-secondary">Hozircha takliflar yo&apos;q</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.referrals.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-xl border border-border-tertiary bg-surface p-3.5 shadow-card"
                    >
                      <span className="text-sm text-content-secondary">{r.refereePhoneMasked}</span>
                      <Badge variant={r.status === 'REWARDED' ? 'green' : 'gray'}>
                        {REFERRAL_STATUS_LABEL[r.status] ?? r.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {data.cashbackRecords.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">
                  Cashback tarixi
                </p>
                <div className="flex flex-col gap-2">
                  {data.cashbackRecords.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-xl border border-border-tertiary bg-surface p-3.5 shadow-card"
                    >
                      <span className="text-sm text-content-secondary">{c.note ?? 'Cashback'}</span>
                      <span className="text-sm font-semibold tabular-nums text-content-primary">
                        {formatSom(c.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
