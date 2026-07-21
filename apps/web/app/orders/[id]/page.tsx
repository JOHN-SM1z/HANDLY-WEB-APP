'use client';

import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { COMPLEXITY_INFO, type OrderStatus, SERVICE_TIER_INFO } from '@handly/contracts';
import { AppHeader } from '@/components/app-header';
import { OrderStatusBadge } from '@/components/order/order-status-badge';
import { Alert } from '@/components/ui/alert';
import { Badge, Rating } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarIcon, CheckIcon, MapPinIcon, SparkleIcon, VideoIcon } from '@/components/ui/icons';
import { Logo } from '@/components/ui/logo';
import { ApiError } from '@/lib/api';
import { formatSom, formatSomRange } from '@/lib/format';
import { ordersApi } from '@/lib/orders';
import { useSocketEvent } from '@/lib/socket';
import { useRequireAuth } from '@/lib/use-require-auth';

const CANCELABLE: OrderStatus[] = ['DRAFT', 'PRICED', 'SEARCHING', 'ASSIGNED'];

export default function OrderDetailPage() {
  const { ready, user } = useRequireAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', params.id],
    queryFn: () => ordersApi.get(params.id),
    enabled: Boolean(user) && Boolean(params.id),
  });

  // Live push while dispatch is running (M3) — a master accepting/the pool
  // exhausting flips status server-side; refetch this order when it does.
  useSocketEvent<{ orderId: string }>('order:updated', (payload) => {
    if (payload.orderId === params.id) {
      void queryClient.invalidateQueries({ queryKey: ['order', params.id] });
    }
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

  async function handleCancel() {
    if (!order) return;
    setCancelling(true);
    setError(null);
    try {
      await ordersApi.cancel(order.id);
      await queryClient.invalidateQueries({ queryKey: ['order', order.id] });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      setConfirmingCancel(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Bekor qilishda xatolik');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
      <AppHeader backHref="/orders" title={order ? `#${order.orderNo}` : 'Buyurtma'} />

      {isLoading || !order ? (
        <div className="flex flex-1 flex-col gap-3 px-5 py-5">
          {Array.from({ length: 3 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="h-16 animate-pulse rounded-xl bg-background-secondary" />
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4 px-5 py-5">
          {error && <Alert>{error}</Alert>}

          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-content-primary">
              {order.categoryName ?? 'Xizmat'}
            </h2>
            <OrderStatusBadge status={order.status} />
          </div>

          <p className="text-sm leading-relaxed text-content-secondary">{order.description}</p>

          {order.media.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {order.media.map((m) =>
                m.kind === 'PHOTO' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={m.id}
                    src={m.url}
                    alt=""
                    className="h-20 w-20 rounded-lg border border-border-secondary object-cover"
                  />
                ) : (
                  <a
                    key={m.id}
                    href={m.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-border-secondary bg-background-secondary text-content-muted"
                  >
                    <VideoIcon width={20} height={20} />
                    <span className="text-[10px]">Video</span>
                  </a>
                ),
              )}
            </div>
          )}

          {(order.addressText || order.scheduledAt) && (
            <div className="flex flex-col gap-1.5 rounded-xl border border-border-tertiary bg-surface p-3 shadow-card">
              {order.addressText && (
                <div className="flex items-center gap-2 text-sm text-content-secondary">
                  <MapPinIcon width={14} height={14} className="shrink-0 text-content-muted" />
                  {order.addressText}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-content-secondary">
                <CalendarIcon width={14} height={14} className="shrink-0 text-content-muted" />
                {order.serviceTier === 'SCHEDULED' && order.scheduledAt
                  ? new Date(order.scheduledAt).toLocaleString('uz-UZ', {
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : SERVICE_TIER_INFO[order.serviceTier].etaUz}
                <Badge variant="gray">{SERVICE_TIER_INFO[order.serviceTier].labelUz}</Badge>
              </div>
            </div>
          )}

          {order.aiDiagnosis && (
            <div className="rounded-xl border border-border-tertiary bg-surface p-4 shadow-card">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <SparkleIcon width={13} height={13} />
                </span>
                <p className="text-sm font-semibold text-content-primary">AI tashxisi</p>
              </div>
              <p className="text-sm leading-relaxed text-content-secondary">
                {order.aiDiagnosis.issueSummary}
              </p>
              {order.complexity && (
                <Badge variant="gray" className="mt-2">
                  {COMPLEXITY_INFO[order.complexity].labelUz}
                </Badge>
              )}
            </div>
          )}

          {order.priceMin != null && order.priceMax != null && (
            <div className="rounded-xl bg-background-secondary p-4">
              <span className="text-xs text-content-muted">Narx diapazoni</span>
              <p className="mt-1 text-lg font-semibold tabular-nums text-content-primary">
                {formatSomRange(order.priceMin, order.priceMax)}
              </p>
              {order.platformFee > 0 && (
                <p className="mt-1 text-xs text-content-secondary">
                  + {formatSom(order.platformFee)} platforma haqi
                </p>
              )}
            </div>
          )}

          {order.status === 'SEARCHING' && (
            <div className="rounded-xl border border-info-bg bg-info-bg p-4 text-center">
              <p className="text-sm font-medium text-info-fg">Sizga mos usta izlanmoqda…</p>
            </div>
          )}

          {order.status === 'EXPIRED' && (
            <div className="rounded-xl border border-border-tertiary bg-background-secondary p-4 text-center">
              <p className="text-sm font-medium text-content-primary">Hozircha mos usta topilmadi</p>
              <p className="mt-1 text-xs text-content-secondary">
                Qo&apos;llab-quvvatlash xizmatiga murojaat qiling yoki qayta urinib ko&apos;ring.
              </p>
            </div>
          )}

          {order.status === 'ASSIGNED' && order.master && (
            <div className="flex items-center gap-3 rounded-xl border border-primary bg-surface p-4 shadow-card">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-soft-fg">
                {(order.master.fullName ?? 'US').slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-content-primary">
                  {order.master.fullName ?? 'Usta'}
                  <CheckIcon width={13} height={13} strokeWidth={2.6} className="text-primary" />
                </div>
                <Rating value={order.master.ratingAvg.toFixed(2)} className="mt-0.5 text-xs" />
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">
              Holat tarixi
            </p>
            <div className="flex flex-col gap-2">
              {order.history.map((h, i) => (
                <div key={`${h.toStatus}-${i}`} className="flex items-center gap-2 text-xs text-content-secondary">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <OrderStatusBadge status={h.toStatus} />
                  <span className="tabular-nums">
                    {new Date(h.createdAt).toLocaleString('uz-UZ', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {CANCELABLE.includes(order.status) && (
            <div className="mt-auto">
              {confirmingCancel ? (
                <div className="flex flex-col gap-2 rounded-xl border border-danger-solid bg-danger-bg p-3">
                  <p className="text-sm text-danger-fg">Buyurtmani bekor qilishni tasdiqlaysizmi?</p>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setConfirmingCancel(false)}>
                      Yo&apos;q
                    </Button>
                    <Button
                      variant="danger"
                      className="flex-1"
                      loading={cancelling}
                      onClick={() => void handleCancel()}
                    >
                      Ha, bekor qilish
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" fullWidth onClick={() => setConfirmingCancel(true)}>
                  Buyurtmani bekor qilish
                </Button>
              )}
            </div>
          )}

          {order.status === 'DRAFT' && (
            <Button
              fullWidth
              onClick={() => router.push(`/orders/new?resume=${order.id}`)}
            >
              Davom ettirish
            </Button>
          )}
        </div>
      )}
    </main>
  );
}
