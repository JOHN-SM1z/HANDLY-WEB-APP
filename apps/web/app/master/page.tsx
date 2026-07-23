'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OfferDto } from '@handly/contracts';
import { BookingRequestCard } from '@/components/master/booking-request-card';
import { LiveTrackingMap } from '@/components/map/live-tracking-map';
import { OnlineToggle } from '@/components/master/online-toggle';
import { RouteTimeline, type TimelineItem } from '@/components/master/route-timeline';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CameraIcon, CheckIcon, DropletIcon, PhoneIcon } from '@/components/ui/icons';
import { Logo } from '@/components/ui/logo';
import { Rating } from '@/components/ui/badge';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api';
import { formatSom } from '@/lib/format';
import { masterApi } from '@/lib/master';
import { subscriptionsApi } from '@/lib/subscriptions';
import { trustApi } from '@/lib/trust';
import { verificationApi } from '@/lib/verification';
import { useSocketEvent } from '@/lib/socket';
import { useRequireAuth } from '@/lib/use-require-auth';

const NAV_ITEMS = [
  {
    label: 'Boshqaruv',
    active: true,
    icon: (
      <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    label: 'Jadval',
    active: false,
    icon: (
      <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M3 11h18" />
      </svg>
    ),
  },
  {
    label: 'Suhbatlar',
    active: false,
    icon: (
      <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.9L3 20l1-5a8.3 8.3 0 0 1-1-4A8.4 8.4 0 0 1 11.5 3a8.4 8.4 0 0 1 9.5 8.5z" />
      </svg>
    ),
  },
  {
    label: 'Daromad',
    active: false,
    icon: (
      <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" />
      </svg>
    ),
  },
];

const JOB_STATUS_META: Record<string, string> = {
  ASSIGNED: 'Tayinlandi',
  EN_ROUTE: "Yo'lda",
  IN_PROGRESS: 'Bajarilmoqda',
  COMPLETED: 'Mijoz tasdiqlashini kutmoqda',
};

const LIVE_TRACKING_STATUSES = ['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS'];

function initialsOf(fullName: string | null, phone: string): string {
  if (fullName) {
    const parts = fullName.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || fullName.slice(0, 2).toUpperCase();
  }
  return phone.slice(-2);
}

/**
 * Real Master Dashboard (M3) — was a static/presentational demo; now wired to
 * the dispatch API + socket events. No fabricated earnings/route data: the
 * old "340k today / 3-5 jobs / 98% acceptance" stat strip and weekly chart
 * are gone since no wallet/earnings ledger exists until M4 — replaced with
 * the master's real lifetime rating + completed-jobs count.
 */
export default function MasterDashboardPage() {
  const { ready, user } = useRequireAuth('MASTER');
  const router = useRouter();
  const queryClient = useQueryClient();
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [finalAmount, setFinalAmount] = useState('');
  const [jobError, setJobError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const evidenceInputRef = useRef<HTMLInputElement>(null);

  const {
    data: profile,
    isError: profileError,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ['master', 'profile'],
    queryFn: masterApi.getProfile,
    enabled: Boolean(user),
  });
  const { data: offer } = useQuery({
    queryKey: ['master', 'offer'],
    queryFn: masterApi.getCurrentOffer,
    enabled: Boolean(user) && profile?.isOnline === true,
  });
  const { data: currentJob } = useQuery({
    queryKey: ['master', 'current-job'],
    queryFn: masterApi.getCurrentJob,
    enabled: Boolean(user),
  });
  const { data: trust } = useQuery({
    queryKey: ['master', 'trust'],
    queryFn: trustApi.getMine,
    enabled: Boolean(user),
  });
  const { data: verification } = useQuery({
    queryKey: ['master', 'verification'],
    queryFn: verificationApi.getMine,
    enabled: Boolean(user),
  });
  const { data: subscription } = useQuery({
    queryKey: ['master', 'subscription'],
    queryFn: subscriptionsApi.getMine,
    enabled: Boolean(user),
  });

  useSocketEvent<OfferDto>('offer:received', (payload) => {
    queryClient.setQueryData(['master', 'offer'], payload);
  });
  useSocketEvent('order:updated', () => {
    queryClient.invalidateQueries({ queryKey: ['master', 'current-job'] });
  });

  const toggleAvailability = useMutation({
    mutationFn: (isOnline: boolean) => masterApi.setAvailability({ isOnline }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['master', 'profile'], (prev: typeof profile) =>
        prev ? { ...prev, ...updated } : prev,
      );
      if (!updated.isOnline) queryClient.setQueryData(['master', 'offer'], null);
    },
  });

  const acceptOffer = useMutation({
    mutationFn: (dispatchId: string) => masterApi.acceptOffer(dispatchId),
    onSuccess: () => {
      queryClient.setQueryData(['master', 'offer'], null);
      void queryClient.invalidateQueries({ queryKey: ['master', 'current-job'] });
    },
  });
  const declineOffer = useMutation({
    mutationFn: (dispatchId: string) => masterApi.declineOffer(dispatchId),
    onSuccess: () => queryClient.setQueryData(['master', 'offer'], null),
  });

  const invalidateCurrentJob = () => queryClient.invalidateQueries({ queryKey: ['master', 'current-job'] });

  const startEnRoute = useMutation({
    mutationFn: (orderId: string) => masterApi.startEnRoute(orderId),
    onSuccess: () => void invalidateCurrentJob(),
    onError: (err) => setJobError(err instanceof ApiError ? err.message : 'Xatolik yuz berdi'),
  });
  const startService = useMutation({
    mutationFn: (orderId: string) => masterApi.startService(orderId),
    onSuccess: () => void invalidateCurrentJob(),
    onError: (err) => setJobError(err instanceof ApiError ? err.message : 'Xatolik yuz berdi'),
  });
  const completeService = useMutation({
    mutationFn: ({ orderId, amount }: { orderId: string; amount: number }) =>
      masterApi.completeService(orderId, amount),
    onSuccess: () => {
      setShowCompleteForm(false);
      setFinalAmount('');
      void invalidateCurrentJob();
    },
    onError: (err) => setJobError(err instanceof ApiError ? err.message : 'Xatolik yuz berdi'),
  });
  const uploadEvidence = useMutation({
    mutationFn: ({ orderId, file }: { orderId: string; file: File }) =>
      masterApi.uploadJobMedia(orderId, file),
    onSuccess: () => void invalidateCurrentJob(),
    onError: (err) => setJobError(err instanceof ApiError ? err.message : 'Yuklashda xatolik'),
  });
  const cancelJob = useMutation({
    mutationFn: (orderId: string) => masterApi.cancelJob(orderId),
    onSuccess: () => {
      setConfirmingCancel(false);
      void invalidateCurrentJob();
    },
    onError: (err) => setJobError(err instanceof ApiError ? err.message : 'Xatolik yuz berdi'),
  });
  const upgradeSubscription = useMutation({
    mutationFn: () => subscriptionsApi.upgrade(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['master', 'subscription'] }),
  });

  useEffect(() => {
    if (!offer) {
      setCountdown(null);
      return;
    }
    const tick = () => setCountdown(Math.max(0, Math.round((new Date(offer.expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [offer]);

  useEffect(() => {
    setShowCompleteForm(false);
    setFinalAmount('');
    setJobError(null);
  }, [currentJob?.id]);

  if (ready && user && profileError) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 px-6 text-center">
        <Alert>Profilni yuklab bo&apos;lmadi</Alert>
        <Button variant="outline" onClick={() => void refetchProfile()}>
          Qayta urinish
        </Button>
      </main>
    );
  }

  if (!ready || !user || !profile) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <div className="animate-pulse">
          <Logo size={44} />
        </div>
      </main>
    );
  }

  const evidenceMedia = currentJob?.media.filter((m) => m.uploadedByRole === 'MASTER') ?? [];

  const currentJobActions = currentJob && (
    <div className="mt-2.5 flex flex-col gap-2">
      {jobError && <Alert>{jobError}</Alert>}

      {evidenceMedia.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {evidenceMedia.map((m) =>
            m.kind === 'PHOTO' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={m.id} src={m.url} alt="" className="h-12 w-12 rounded-md border border-border-secondary object-cover" />
            ) : (
              <a
                key={m.id}
                href={m.url}
                target="_blank"
                rel="noreferrer"
                className="flex h-12 w-12 items-center justify-center rounded-md border border-border-secondary bg-background-secondary text-[9px] text-content-muted"
              >
                Video
              </a>
            ),
          )}
        </div>
      )}

      {currentJob.status === 'ASSIGNED' && (
        <Button
          size="sm"
          fullWidth
          loading={startEnRoute.isPending}
          onClick={() => {
            setJobError(null);
            startEnRoute.mutate(currentJob.id);
          }}
        >
          Yo&apos;lga chiqish
        </Button>
      )}

      {currentJob.status === 'EN_ROUTE' && (
        <Button
          size="sm"
          fullWidth
          loading={startService.isPending}
          onClick={() => {
            setJobError(null);
            startService.mutate(currentJob.id);
          }}
        >
          Ishni boshlash
        </Button>
      )}

      {(currentJob.status === 'ASSIGNED' || currentJob.status === 'EN_ROUTE') &&
        (confirmingCancel ? (
          <div className="flex flex-col gap-2 rounded-md border border-danger-solid bg-danger-bg p-2.5">
            <p className="text-xs text-danger-fg">
              Bekor qilish jarima bilan qayd etiladi. Davom etasizmi?
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirmingCancel(false)}>
                Yo&apos;q
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="flex-1"
                loading={cancelJob.isPending}
                onClick={() => {
                  setJobError(null);
                  cancelJob.mutate(currentJob.id);
                }}
              >
                Ha, bekor qilish
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" fullWidth onClick={() => setConfirmingCancel(true)}>
            Ishni bekor qilish
          </Button>
        ))}

      {(currentJob.status === 'IN_PROGRESS' || currentJob.status === 'COMPLETED') && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => evidenceInputRef.current?.click()}
            aria-label="Dalil-rasm yuklash"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-sm border border-border-primary text-content-secondary"
          >
            <CameraIcon width={15} height={15} />
          </button>
          {currentJob.status === 'IN_PROGRESS' && !showCompleteForm && (
            <Button size="sm" fullWidth onClick={() => setShowCompleteForm(true)}>
              <CheckIcon width={13} height={13} strokeWidth={2.4} />
              Bajarildi deb belgilash
            </Button>
          )}
          {currentJob.status === 'COMPLETED' && (
            <span className="flex flex-1 items-center justify-center rounded-sm bg-background-secondary text-xs font-medium text-content-secondary">
              Tasdiqlashni kutmoqda…
            </span>
          )}
        </div>
      )}

      {currentJob.status === 'IN_PROGRESS' && showCompleteForm && (
        <div className="flex flex-col gap-2 rounded-md border border-border-tertiary bg-background-secondary p-2.5">
          <TextField
            type="number"
            inputMode="numeric"
            label="Yakuniy narx (so'm)"
            placeholder={
              currentJob.priceMin != null && currentJob.priceMax != null
                ? `${currentJob.priceMin}–${currentJob.priceMax}`
                : undefined
            }
            value={finalAmount}
            onChange={(e) => setFinalAmount(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowCompleteForm(false)}>
              Bekor qilish
            </Button>
            <Button
              size="sm"
              className="flex-1"
              loading={completeService.isPending}
              disabled={!finalAmount || Number(finalAmount) <= 0}
              onClick={() => {
                setJobError(null);
                completeService.mutate({ orderId: currentJob.id, amount: Math.round(Number(finalAmount)) });
              }}
            >
              Tasdiqlash
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const routeItems: TimelineItem[] = currentJob
    ? [
        {
          id: currentJob.id,
          title: `${currentJob.categoryName ?? 'Buyurtma'} — ${currentJob.addressText ?? ''}`,
          time: 'hozir',
          meta: `${JOB_STATUS_META[currentJob.status] ?? currentJob.status} · taxminiy ${currentJob.priceMin != null && currentJob.priceMax != null ? `${formatSom(currentJob.priceMin)}–${formatSom(currentJob.priceMax)}` : "narx yo'q"}`,
          status: 'active',
          actions: currentJobActions,
        },
      ]
    : [];

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-background">
      {/* dark header */}
      <div className="bg-ink text-ink-fg">
        <div className="flex items-center px-5 pt-3">
          <Link href="/home" aria-label="Bosh sahifa">
            <Logo size={22} inverse />
          </Link>
        </div>
        <div className="flex items-center gap-3 px-5 pb-4 pt-2">
          <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full bg-primary text-base font-bold text-white">
            {initialsOf(profile.fullName, user.phone)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-base font-bold">
              {profile.fullName ?? user.phone}
              {profile.verificationStatus === 'VERIFIED' && (
                <CheckIcon width={15} height={15} strokeWidth={2.6} className="text-primary" />
              )}
            </div>
            <div className="flex items-center gap-1 text-xs opacity-70">
              {profile.skills[0]?.nameUz ?? 'Usta'} · <Rating value={profile.ratingAvg.toFixed(2)} className="text-inherit" /> · {profile.jobsDone} ish
            </div>
          </div>
          <OnlineToggle
            online={profile.isOnline}
            onChange={(next) => toggleAvailability.mutate(next)}
          />
        </div>

        <div className="grid grid-cols-3 gap-px border-t border-white/10 bg-white/10">
          <div className="bg-ink px-3 py-3.5 text-center">
            <div className="text-lg font-bold">{profile.jobsDone}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wide opacity-65">Bajarilgan ishlar</div>
          </div>
          <div className="bg-ink px-3 py-3.5 text-center">
            <div className="text-lg font-bold text-primary">{profile.ratingAvg.toFixed(2)}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wide opacity-65">Reyting</div>
          </div>
          <div className="bg-ink px-3 py-3.5 text-center">
            <div className="text-lg font-bold text-primary">T{trust?.tier ?? 0}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wide opacity-65">Ishonch darajasi</div>
          </div>
        </div>
      </div>

      {/* scroll area */}
      <div className="flex flex-1 flex-col gap-4 px-5 py-4">
        {!profile.isOnline && (
          <div className="rounded-lg border border-border-tertiary bg-background-secondary px-4 py-3.5 text-center text-sm text-content-secondary">
            Yangi takliflarni ko&apos;rish uchun onlayn bo&apos;ling.
          </div>
        )}

        {profile.verificationStatus === 'PENDING' && (
          <div className="rounded-lg border border-info-bg bg-info-bg px-4 py-3 text-center text-sm text-info-fg">
            Tasdiqlash so&apos;rovingiz ko&apos;rib chiqilmoqda.
          </div>
        )}
        {(profile.verificationStatus === 'UNVERIFIED' || profile.verificationStatus === 'REJECTED') && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border-tertiary bg-surface px-4 py-3 shadow-card">
            <div>
              <p className="text-sm font-medium text-content-primary">
                {profile.verificationStatus === 'REJECTED' ? 'Tasdiqlash rad etildi' : 'Profilingizni tasdiqlang'}
              </p>
              <p className="mt-0.5 text-xs text-content-muted">
                {verification?.note || "Tasdiqlangan usta ko'proq buyurtma oladi"}
              </p>
            </div>
            <Button size="sm" onClick={() => router.push('/master/onboarding')}>
              To&apos;ldirish
            </Button>
          </div>
        )}
        {/* Beta Blocker Sprint: skills/service area are what dispatch actually
            requires to ever offer this master a job — surfaced separately
            from verification status since a VERIFIED-but-incomplete profile
            (e.g. seeded directly) would otherwise never see any prompt. */}
        {profile.verificationStatus !== 'UNVERIFIED' &&
          profile.verificationStatus !== 'REJECTED' &&
          (profile.skills.length === 0 || profile.serviceAreas.length === 0) && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-warning-bg bg-warning-bg px-4 py-3">
              <div>
                <p className="text-sm font-medium text-warning-fg">Profil to&apos;liq emas</p>
                <p className="mt-0.5 text-xs text-warning-fg opacity-80">
                  Xizmat turi va ish hududini belgilamaguningizcha buyurtma ololmaysiz.
                </p>
              </div>
              <Button size="sm" onClick={() => router.push('/master/onboarding')}>
                To&apos;ldirish
              </Button>
            </div>
          )}

        {subscription && !subscription.isPremiumActive && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-primary bg-primary-soft px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-primary-soft-fg">Premium&apos;ga o&apos;ting</p>
              <p className="mt-0.5 text-xs text-primary-soft-fg opacity-80">
                Ko&apos;proq ko&apos;rinish va ustuvor buyurtmalar — 14 kun bepul
              </p>
            </div>
            <Button size="sm" variant="brand" loading={upgradeSubscription.isPending} onClick={() => upgradeSubscription.mutate()}>
              Sinab ko&apos;rish
            </Button>
          </div>
        )}
        {subscription?.isPremiumActive && (
          <div className="rounded-lg border border-primary bg-primary-soft px-4 py-2.5 text-center text-xs font-medium text-primary-soft-fg">
            Premium faol{subscription.status === 'TRIAL' ? ' (sinov muddati)' : ''}
          </div>
        )}
        {offer && countdown !== null && countdown > 0 && (
          <BookingRequestCard
            icon={<DropletIcon width={20} height={20} />}
            title={`${offer.categoryName ?? 'Buyurtma'} — ${offer.description.slice(0, 60)}`}
            meta={`${offer.addressText ?? ''} · ${(offer.distanceM / 1000).toFixed(1)} km`}
            payout={offer.priceMin != null ? formatSom(offer.priceMin) : "narx yo'q"}
            countdown={countdown}
            onAccept={() => acceptOffer.mutate(offer.dispatchId)}
            onDecline={() => declineOffer.mutate(offer.dispatchId)}
          />
        )}

        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-lg font-bold tracking-tight">Joriy ish</span>
            <div className="flex gap-3">
              <Link href="/master/analytics" className="text-xs font-medium text-primary">
                Statistika
              </Link>
              <Link href="/master/earnings" className="text-xs font-medium text-primary">
                Daromad
              </Link>
              <Link href="/master/jobs" className="text-xs font-medium text-primary">
                Ish tarixi
              </Link>
            </div>
          </div>
          {routeItems.length > 0 ? (
            <RouteTimeline items={routeItems} />
          ) : (
            <div className="rounded-lg border border-border-tertiary bg-surface px-4 py-6 text-center text-sm text-content-muted shadow-card">
              Hozircha tayinlangan ish yo&apos;q.
            </div>
          )}
          {/* Beta Blocker Sprint — minimal contact channel: a tel: link, not
              a chat system. Only ever rendered once currentJob.customer is
              populated by the API, which itself only happens at ASSIGNED+. */}
          {currentJob?.customer && (
            <a
              href={`tel:${currentJob.customer.phone}`}
              className="mt-3 flex items-center gap-3 rounded-lg border border-border-tertiary bg-surface px-4 py-3 shadow-card transition-colors hover:bg-background-secondary"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary-soft-fg">
                <PhoneIcon width={18} height={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-content-primary">
                  {currentJob.customer.fullName ?? 'Mijoz'}
                </p>
                <p className="text-xs text-content-muted">Qo&apos;ng&apos;iroq qilish</p>
              </div>
            </a>
          )}
          {currentJob && (
            <LiveTrackingMap
              active={LIVE_TRACKING_STATUSES.includes(currentJob.status)}
              initialCounterpartPosition={
                currentJob.latitude != null && currentJob.longitude != null
                  ? { latitude: currentJob.latitude, longitude: currentJob.longitude }
                  : null
              }
              counterpartLabel={currentJob.customer?.fullName ?? 'Mijoz'}
            />
          )}
          <input
            ref={evidenceInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file && currentJob) {
                setJobError(null);
                uploadEvidence.mutate({ orderId: currentJob.id, file });
              }
            }}
          />
        </div>
      </div>

      {/* master-specific bottom nav (Jadval/Suhbatlar/Daromad are placeholders — later milestones) */}
      <div className="grid grid-cols-4 border-t border-border-tertiary bg-surface px-2 pb-[22px] pt-2.5">
        {NAV_ITEMS.map((item) => (
          <span
            key={item.label}
            className={`flex flex-col items-center gap-1 ${item.active ? 'text-primary' : 'text-content-muted'}`}
          >
            {item.icon}
            <span className={`text-[10px] ${item.active ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
