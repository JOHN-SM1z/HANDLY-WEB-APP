'use client';

import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  COMPLEXITY_INFO,
  type OrderStatus,
  PAYMENT_METHOD_INFO,
  type PaymentMethod,
  type PaymentStatus,
  SERVICE_TIER_INFO,
} from '@handly/contracts';
import { AppHeader } from '@/components/app-header';
import { LiveTrackingMap } from '@/components/map/live-tracking-map';
import { OrderStatusBadge } from '@/components/order/order-status-badge';
import { Alert } from '@/components/ui/alert';
import { Badge, Rating } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarIcon, CheckIcon, MapPinIcon, PhoneIcon, SparkleIcon, VideoIcon } from '@/components/ui/icons';
import { Logo } from '@/components/ui/logo';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { formatSom, formatSomRange } from '@/lib/format';
import { guaranteeApi } from '@/lib/guarantee';
import { ordersApi } from '@/lib/orders';
import { paymentsApi } from '@/lib/payments';
import { reviewsApi } from '@/lib/reviews';
import { useSocketEvent } from '@/lib/socket';
import { useRequireAuth } from '@/lib/use-require-auth';

const CANCELABLE: OrderStatus[] = ['DRAFT', 'PRICED', 'SEARCHING', 'ASSIGNED', 'EN_ROUTE'];
const ASSIGNED_STATUSES: OrderStatus[] = ['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'];
const LIVE_TRACKING_STATUSES: OrderStatus[] = ['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS'];
const PAYABLE_STATUSES: OrderStatus[] = ['COMPLETED', 'CLOSED'];
const PAYMENT_METHODS: PaymentMethod[] = ['MOCK', 'CLICK', 'PAYME', 'UZUM'];
const PAYMENT_STATUS_LABEL: Record<PaymentStatus, { labelUz: string; variant: 'gray' | 'blue' | 'green' | 'red' }> = {
  PENDING: { labelUz: 'Kutilmoqda', variant: 'gray' },
  PROCESSING: { labelUz: 'Jarayonda', variant: 'blue' },
  SUCCEEDED: { labelUz: "To'landi", variant: 'green' },
  FAILED: { labelUz: 'Amalga oshmadi', variant: 'red' },
  CANCELLED: { labelUz: 'Bekor qilindi', variant: 'gray' },
  REFUNDED: { labelUz: 'Qaytarildi', variant: 'blue' },
};

export default function OrderDetailPage() {
  const { ready, user } = useRequireAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('MOCK');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [showGuaranteeForm, setShowGuaranteeForm] = useState(false);
  const [guaranteeReason, setGuaranteeReason] = useState('');
  const [submittingGuarantee, setSubmittingGuarantee] = useState(false);
  const [guaranteeError, setGuaranteeError] = useState<string | null>(null);

  const { data: order, isLoading, isError, refetch } = useQuery({
    queryKey: ['order', params.id],
    queryFn: () => ordersApi.get(params.id),
    enabled: Boolean(user) && Boolean(params.id),
  });

  const { data: paymentPage, refetch: refetchPayments } = useQuery({
    queryKey: ['order', params.id, 'payments'],
    queryFn: () => paymentsApi.list(params.id),
    enabled: Boolean(user) && Boolean(params.id) && Boolean(order && PAYABLE_STATUSES.includes(order.status)),
  });

  const { data: review, refetch: refetchReview } = useQuery({
    queryKey: ['order', params.id, 'review'],
    queryFn: () => reviewsApi.getForOrder(params.id),
    enabled: Boolean(user) && Boolean(params.id) && order?.status === 'CLOSED',
  });

  const { data: guaranteeClaim, refetch: refetchGuaranteeClaim } = useQuery({
    queryKey: ['order', params.id, 'guarantee-claim'],
    queryFn: () => guaranteeApi.getForOrder(params.id),
    enabled: Boolean(user) && Boolean(params.id) && order?.status === 'CLOSED',
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

  const customerMedia = order?.media.filter((m) => m.uploadedByRole === 'CUSTOMER') ?? [];
  const masterMedia = order?.media.filter((m) => m.uploadedByRole === 'MASTER') ?? [];

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

  async function handleConfirm() {
    if (!order) return;
    setConfirming(true);
    setError(null);
    try {
      await ordersApi.confirm(order.id);
      await queryClient.invalidateQueries({ queryKey: ['order', order.id] });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tasdiqlashda xatolik');
    } finally {
      setConfirming(false);
    }
  }

  async function handlePay() {
    if (!order) return;
    setPaying(true);
    setPayError(null);
    try {
      await paymentsApi.initiate(order.id, selectedMethod);
      await refetchPayments();
    } catch (err) {
      setPayError(err instanceof ApiError ? err.message : "To'lovda xatolik");
    } finally {
      setPaying(false);
    }
  }

  async function handleSubmitReview() {
    if (!order || reviewRating === 0) return;
    setSubmittingReview(true);
    setReviewError(null);
    try {
      await reviewsApi.create(order.id, { rating: reviewRating, comment: reviewComment.trim() || undefined });
      await refetchReview();
    } catch (err) {
      setReviewError(err instanceof ApiError ? err.message : 'Baho qo\'yishda xatolik');
    } finally {
      setSubmittingReview(false);
    }
  }

  async function handleFileGuaranteeClaim() {
    if (!order || guaranteeReason.trim().length < 10) return;
    setSubmittingGuarantee(true);
    setGuaranteeError(null);
    try {
      await guaranteeApi.fileClaim(order.id, { reason: guaranteeReason.trim() });
      setShowGuaranteeForm(false);
      await refetchGuaranteeClaim();
    } catch (err) {
      setGuaranteeError(err instanceof ApiError ? err.message : "Kafolat so'rovida xatolik");
    } finally {
      setSubmittingGuarantee(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
      <AppHeader backHref="/orders" title={order ? `#${order.orderNo}` : 'Buyurtma'} />

      {isError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <Alert>Buyurtmani yuklab bo&apos;lmadi</Alert>
          <Button variant="outline" onClick={() => void refetch()}>
            Qayta urinish
          </Button>
        </div>
      ) : isLoading || !order ? (
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

          {customerMedia.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {customerMedia.map((m) =>
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

          {ASSIGNED_STATUSES.includes(order.status) && order.master && (
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
              {/* Beta Blocker Sprint — minimal contact channel (tel: link,
                  not a chat system). order.master only ever reaches the
                  customer once ASSIGNED, so this is never shown earlier. */}
              <a
                href={`tel:${order.master.phone}`}
                aria-label="Ustaga qo'ng'iroq qilish"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary-soft text-primary-soft-fg"
              >
                <PhoneIcon width={16} height={16} />
              </a>
            </div>
          )}

          <LiveTrackingMap
            active={LIVE_TRACKING_STATUSES.includes(order.status)}
            counterpartLabel={order.master?.fullName ?? 'Usta'}
          />

          {order.status === 'EN_ROUTE' && (
            <div className="rounded-xl border border-info-bg bg-info-bg p-4 text-center">
              <p className="text-sm font-medium text-info-fg">Usta sizga tomon yo&apos;lda</p>
            </div>
          )}

          {order.status === 'IN_PROGRESS' && (
            <div className="rounded-xl border border-info-bg bg-info-bg p-4 text-center">
              <p className="text-sm font-medium text-info-fg">Usta ish joyida — xizmat bajarilmoqda</p>
            </div>
          )}

          {order.status === 'COMPLETED' && (
            <div className="flex flex-col gap-3 rounded-xl border border-success-bg bg-success-bg p-4">
              <div className="text-center">
                <p className="text-sm font-medium text-success-fg">Usta ishni tugallandi deb belgiladi</p>
                {order.finalAmount != null && (
                  <p className="mt-1 text-lg font-semibold tabular-nums text-content-primary">
                    {formatSom(order.finalAmount)}
                  </p>
                )}
              </div>
              {masterMedia.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2">
                  {masterMedia.map((m) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={m.id}
                      src={m.url}
                      alt=""
                      className="h-16 w-16 rounded-lg border border-border-secondary object-cover"
                    />
                  ))}
                </div>
              )}
              <Button fullWidth loading={confirming} onClick={() => void handleConfirm()}>
                Ishni qabul qilish va yopish
              </Button>
            </div>
          )}

          {order.status === 'CLOSED' && (
            <div className="rounded-xl border border-border-tertiary bg-background-secondary p-4 text-center">
              <p className="text-sm font-medium text-content-primary">Buyurtma yakunlandi</p>
              {order.finalAmount != null && (
                <p className="mt-1 text-sm tabular-nums text-content-secondary">{formatSom(order.finalAmount)}</p>
              )}
              {masterMedia.length > 0 && (
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {masterMedia.map((m) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={m.id}
                      src={m.url}
                      alt=""
                      className="h-16 w-16 rounded-lg border border-border-secondary object-cover"
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {order.status === 'CLOSED' && (
            <div className="flex flex-col gap-3 rounded-xl border border-border-tertiary bg-surface p-4 shadow-card">
              <p className="text-sm font-semibold text-content-primary">Ustaga baho bering</p>
              {reviewError && <Alert>{reviewError}</Alert>}
              {review ? (
                <div>
                  <Rating value={review.rating.toFixed(2)} />
                  {review.comment && <p className="mt-1 text-sm text-content-secondary">{review.comment}</p>}
                </div>
              ) : (
                <>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        aria-label={`${n} yulduz`}
                        aria-pressed={reviewRating >= n}
                        onClick={() => setReviewRating(n)}
                        className={`flex h-9 w-9 items-center justify-center rounded-md border text-lg ${
                          reviewRating >= n
                            ? 'border-primary bg-primary-soft text-primary-soft-fg'
                            : 'border-border-secondary text-content-muted'
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <Textarea
                    placeholder="Izoh (ixtiyoriy)"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                  />
                  <Button
                    fullWidth
                    loading={submittingReview}
                    disabled={reviewRating === 0}
                    onClick={() => void handleSubmitReview()}
                  >
                    Yuborish
                  </Button>
                </>
              )}
            </div>
          )}

          {order.status === 'CLOSED' && (
            <div className="flex flex-col gap-3 rounded-xl border border-border-tertiary bg-surface p-4 shadow-card">
              <p className="text-sm font-semibold text-content-primary">Handly Kafolati</p>
              {guaranteeError && <Alert>{guaranteeError}</Alert>}
              {guaranteeClaim ? (
                <div className="flex items-center justify-between rounded-lg bg-background-secondary p-3">
                  <p className="text-sm text-content-secondary">{guaranteeClaim.reason}</p>
                  <Badge
                    variant={
                      guaranteeClaim.status === 'APPROVED'
                        ? 'green'
                        : guaranteeClaim.status === 'REJECTED'
                          ? 'red'
                          : 'gray'
                    }
                  >
                    {guaranteeClaim.status === 'OPEN' && 'Yuborilgan'}
                    {guaranteeClaim.status === 'UNDER_REVIEW' && "Ko'rib chiqilmoqda"}
                    {guaranteeClaim.status === 'APPROVED' && 'Tasdiqlandi'}
                    {guaranteeClaim.status === 'REJECTED' && 'Rad etildi'}
                  </Badge>
                </div>
              ) : showGuaranteeForm ? (
                <>
                  <Textarea
                    placeholder="Muammoni tasvirlab bering (kamida 10 ta belgi)"
                    value={guaranteeReason}
                    onChange={(e) => setGuaranteeReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setShowGuaranteeForm(false)}>
                      Bekor qilish
                    </Button>
                    <Button
                      className="flex-1"
                      loading={submittingGuarantee}
                      disabled={guaranteeReason.trim().length < 10}
                      onClick={() => void handleFileGuaranteeClaim()}
                    >
                      Yuborish
                    </Button>
                  </div>
                </>
              ) : (
                <Button variant="outline" fullWidth onClick={() => setShowGuaranteeForm(true)}>
                  Kafolat so&apos;rovi yuborish
                </Button>
              )}
            </div>
          )}

          {PAYABLE_STATUSES.includes(order.status) && (() => {
            const payments = paymentPage?.items ?? [];
            const latest = payments[0];
            const isSettledOrPending = latest && latest.status !== 'FAILED' && latest.status !== 'CANCELLED';

            return (
              <div className="flex flex-col gap-3 rounded-xl border border-border-tertiary bg-surface p-4 shadow-card">
                <p className="text-sm font-semibold text-content-primary">To&apos;lov</p>
                {payError && <Alert>{payError}</Alert>}

                {isSettledOrPending && latest ? (
                  <div className="flex items-center justify-between rounded-lg bg-background-secondary p-3">
                    <div>
                      <p className="text-sm font-medium text-content-primary">
                        {PAYMENT_METHOD_INFO[latest.method].labelUz}
                      </p>
                      <p className="text-xs text-content-muted">
                        {new Date(latest.createdAt).toLocaleString('uz-UZ', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-content-primary">
                        {formatSom(latest.amount)}
                      </p>
                      <Badge variant={PAYMENT_STATUS_LABEL[latest.status].variant} className="mt-0.5">
                        {PAYMENT_STATUS_LABEL[latest.status].labelUz}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <>
                    {latest && latest.status === 'FAILED' && (
                      <Alert>
                        {latest.failureReason ?? "Oxirgi to'lov amalga oshmadi"} — qayta urinib ko&apos;ring.
                      </Alert>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {PAYMENT_METHODS.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setSelectedMethod(m)}
                          className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                            selectedMethod === m
                              ? 'border-primary bg-primary-soft text-primary-soft-fg'
                              : 'border-border-secondary text-content-secondary'
                          }`}
                        >
                          {PAYMENT_METHOD_INFO[m].labelUz}
                        </button>
                      ))}
                    </div>
                    <Button fullWidth loading={paying} onClick={() => void handlePay()}>
                      {order.finalAmount != null ? `${formatSom(order.finalAmount)} to'lash` : "To'lash"}
                    </Button>
                  </>
                )}

                {payments.length > 1 && (
                  <div className="flex flex-col gap-1.5 border-t border-border-tertiary pt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-content-muted">
                      To&apos;lov tarixi
                    </p>
                    {payments.slice(1).map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-xs text-content-secondary">
                        <span>{PAYMENT_METHOD_INFO[p.method].labelUz}</span>
                        <span className="tabular-nums">{formatSom(p.amount)}</span>
                        <Badge variant={PAYMENT_STATUS_LABEL[p.status].variant}>
                          {PAYMENT_STATUS_LABEL[p.status].labelUz}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

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
