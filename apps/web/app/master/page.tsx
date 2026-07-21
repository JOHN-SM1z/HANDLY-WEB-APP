'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OfferDto } from '@handly/contracts';
import { BookingRequestCard } from '@/components/master/booking-request-card';
import { OnlineToggle } from '@/components/master/online-toggle';
import { RouteTimeline, type TimelineItem } from '@/components/master/route-timeline';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckIcon, DropletIcon, PhoneIcon } from '@/components/ui/icons';
import { Logo } from '@/components/ui/logo';
import { Rating } from '@/components/ui/badge';
import { formatSom } from '@/lib/format';
import { masterApi } from '@/lib/master';
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
  const { ready, user } = useRequireAuth();
  const queryClient = useQueryClient();
  const [countdown, setCountdown] = useState<number | null>(null);

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

  const currentJobActions = (
    <div className="mt-2.5 flex gap-2">
      {/* Presentational placeholder — job execution/completion is M4 (see CLAUDE.md). Real
          <button disabled> so it's honestly non-interactive to keyboard/screen readers too,
          not just visually — a styled span that looks clickable but does nothing is worse. */}
      <button
        type="button"
        disabled
        aria-label="Bajarildi deb belgilash (hali mavjud emas)"
        className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-sm bg-ink text-xs font-semibold text-ink-fg disabled:opacity-100"
      >
        <CheckIcon width={13} height={13} strokeWidth={2.4} />
        Bajarildi deb belgilash
      </button>
      <button
        type="button"
        disabled
        aria-label="Ustaga qo'ng'iroq qilish (hali mavjud emas)"
        className="flex h-9 w-9 items-center justify-center rounded-sm border border-border-primary text-content-secondary disabled:opacity-100"
      >
        <PhoneIcon width={15} height={15} />
      </button>
    </div>
  );

  const routeItems: TimelineItem[] = currentJob
    ? [
        {
          id: currentJob.id,
          title: `${currentJob.categoryName ?? 'Buyurtma'} — ${currentJob.addressText ?? ''}`,
          time: 'hozir',
          meta: `Tayinlangan · taxminiy ${currentJob.priceMin != null && currentJob.priceMax != null ? `${formatSom(currentJob.priceMin)}–${formatSom(currentJob.priceMax)}` : "narx yo'q"}`,
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

        <div className="grid grid-cols-2 gap-px border-t border-white/10 bg-white/10">
          <div className="bg-ink px-3 py-3.5 text-center">
            <div className="text-lg font-bold">{profile.jobsDone}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wide opacity-65">Bajarilgan ishlar</div>
          </div>
          <div className="bg-ink px-3 py-3.5 text-center">
            <div className="text-lg font-bold text-primary">{profile.ratingAvg.toFixed(2)}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wide opacity-65">Reyting</div>
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
          </div>
          {routeItems.length > 0 ? (
            <RouteTimeline items={routeItems} />
          ) : (
            <div className="rounded-lg border border-border-tertiary bg-surface px-4 py-6 text-center text-sm text-content-muted shadow-card">
              Hozircha tayinlangan ish yo&apos;q.
            </div>
          )}
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
