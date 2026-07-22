'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { StatusBadge } from '@/components/admin/status-badge';
import { AppHeader } from '@/components/app-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { Textarea } from '@/components/ui/textarea';
import { Role } from '@handly/contracts';
import { ApiError } from '@/lib/api';
import { adminApi } from '@/lib/admin';
import { formatSom, formatSomRange } from '@/lib/format';
import { useRequireAuth } from '@/lib/use-require-auth';

export default function AdminOrderDetailPage() {
  const { ready, user } = useRequireAuth(Role.ADMIN);
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [resolvingPaymentId, setResolvingPaymentId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [resolveError, setResolveError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'order', params.id],
    queryFn: () => adminApi.orders.detail(params.id),
    enabled: Boolean(user),
  });

  const resolvePayment = useMutation({
    mutationFn: ({ id, refund }: { id: string; refund: boolean }) =>
      adminApi.payments.resolve(id, { refund, note: resolveNote.trim() }),
    onSuccess: () => {
      setResolvingPaymentId(null);
      setResolveNote('');
      setResolveError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'order', params.id] });
    },
    onError: (err) => setResolveError(err instanceof ApiError ? err.message : 'Xatolik yuz berdi'),
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
      <AppHeader title={data ? `Buyurtma #${data.orderNo}` : 'Buyurtma'} backHref="/admin/orders" />

      <div className="flex flex-1 flex-col gap-4 px-5 py-5">
        {isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <Alert>Buyurtmani yuklab bo&apos;lmadi</Alert>
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
            <div className="flex items-center justify-between rounded-xl border border-border-tertiary bg-surface p-4 shadow-card">
              <div>
                <p className="text-sm font-semibold text-content-primary">{data.categoryNameUz ?? 'Xizmat'}</p>
                <p className="text-xs text-content-secondary">{data.serviceTier}</p>
              </div>
              <StatusBadge status={data.status} />
            </div>

            <div className="rounded-xl border border-border-tertiary bg-surface p-4 shadow-card">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-content-muted">Tavsif</p>
              <p className="text-sm text-content-primary">{data.description}</p>
              {data.addressText && <p className="mt-2 text-xs text-content-secondary">{data.addressText}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border-tertiary bg-surface p-4 shadow-card">
                <p className="text-xs text-content-muted">Mijoz</p>
                <p className="text-sm font-medium text-content-primary">{data.customerPhone}</p>
              </div>
              <div className="rounded-xl border border-border-tertiary bg-surface p-4 shadow-card">
                <p className="text-xs text-content-muted">Usta</p>
                <p className="text-sm font-medium text-content-primary">{data.masterPhone ?? '—'}</p>
              </div>
            </div>

            {(data.priceMin != null || data.finalAmount != null) && (
              <div className="rounded-xl border border-border-tertiary bg-surface p-4 shadow-card">
                <p className="text-xs text-content-muted">Narx</p>
                <p className="text-sm font-medium text-content-primary">
                  {data.finalAmount != null
                    ? formatSom(data.finalAmount)
                    : data.priceMin != null && data.priceMax != null
                      ? formatSomRange(data.priceMin, data.priceMax)
                      : '—'}
                </p>
              </div>
            )}

            <section>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">Holat tarixi</h2>
              {data.statusHistory.length === 0 ? (
                <p className="text-sm text-content-secondary">Hozircha yo&apos;q</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.statusHistory.map((h, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <div key={i} className="flex items-center justify-between rounded-lg bg-background-secondary px-3 py-2">
                      <span className="text-xs text-content-secondary">
                        {h.fromStatus ?? '—'} → {h.toStatus}
                      </span>
                      <span className="text-xs text-content-muted">{new Date(h.createdAt).toLocaleString('uz-UZ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Beta Blocker Sprint — the dispatch cascade was already
                returned by the API but never rendered, so "why didn't this
                order match?" required a raw DB query. */}
            <section>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">
                Dispatch tarixi
              </h2>
              {data.dispatches.length === 0 ? (
                <p className="text-sm text-content-secondary">Hozircha yo&apos;q</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.dispatches.map((d, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <div key={i} className="flex items-center justify-between rounded-lg bg-background-secondary px-3 py-2">
                      <span className="truncate text-xs text-content-secondary">{d.masterId}</span>
                      <StatusBadge status={d.status} />
                      <span className="text-xs text-content-muted">{(d.distanceM / 1000).toFixed(1)} km</span>
                      <span className="text-xs text-content-muted">{new Date(d.offeredAt).toLocaleString('uz-UZ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {data.payments.length > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">To&apos;lovlar</h2>
                <div className="flex flex-col gap-2">
                  {data.payments.map((p) => (
                    <div key={p.id} className="flex flex-col gap-2 rounded-lg bg-background-secondary px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-content-secondary">{p.method}</span>
                        <StatusBadge status={p.status} />
                        <span className="text-xs font-medium text-content-primary">{formatSom(p.amount)}</span>
                      </div>
                      {p.failureReason && (
                        <p className="text-xs text-danger-fg">Sabab: {p.failureReason}</p>
                      )}
                      {p.resolutionNote ? (
                        <p className="text-xs text-content-muted">
                          Hal qilindi: {p.resolutionNote}
                          {p.resolvedAt && ` (${new Date(p.resolvedAt).toLocaleString('uz-UZ')})`}
                        </p>
                      ) : (
                        <>
                          {resolvingPaymentId === p.id ? (
                            <div className="flex flex-col gap-2">
                              {resolveError && <Alert>{resolveError}</Alert>}
                              <Textarea
                                placeholder="Sabab / izoh (majburiy)"
                                value={resolveNote}
                                onChange={(e) => setResolveNote(e.target.value)}
                                rows={2}
                              />
                              <div className="flex gap-2">
                                {p.status === 'SUCCEEDED' && (
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    loading={resolvePayment.isPending}
                                    disabled={resolveNote.trim().length < 3}
                                    onClick={() => resolvePayment.mutate({ id: p.id, refund: true })}
                                  >
                                    Qaytarish
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  loading={resolvePayment.isPending}
                                  disabled={resolveNote.trim().length < 3}
                                  onClick={() => resolvePayment.mutate({ id: p.id, refund: false })}
                                >
                                  Hal qilindi deb belgilash
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setResolvingPaymentId(null);
                                    setResolveNote('');
                                    setResolveError(null);
                                  }}
                                >
                                  Bekor qilish
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => setResolvingPaymentId(p.id)}>
                              Muammoni hal qilish
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
