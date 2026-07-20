'use client';

import { useEffect, useState } from 'react';
import { BookingRequestCard } from '@/components/master/booking-request-card';
import { OnlineToggle } from '@/components/master/online-toggle';
import { RouteTimeline, type TimelineItem } from '@/components/master/route-timeline';
import { WeekEarningsChart } from '@/components/master/week-earnings-chart';
import { Button } from '@/components/ui/button';
import { CheckIcon, DropletIcon, PhoneIcon } from '@/components/ui/icons';
import { Logo } from '@/components/ui/logo';
import { Rating } from '@/components/ui/badge';
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
    badge: 2,
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

const ROUTE_BASE: TimelineItem[] = [
  {
    id: 'done-1',
    title: 'Qozon o‘rnatish — Mirzo Ulug‘bek',
    time: '09:00',
    meta: "To'landi · 180 000 so'm · baho ★5",
    status: 'done',
  },
  {
    id: 'done-2',
    title: 'Radiatorni puflash — Shayxontohur',
    time: '11:30',
    meta: "To'landi · 95 000 so'm · baho ★5",
    status: 'done',
  },
];

/**
 * Static, presentational recreation of docs/design/Handly Master Dashboard.dc.html.
 * No backend wiring — matching/dispatch and earnings ledgers are later milestones (M3/M4).
 * All state below (online status, incoming request, route) is local demo state only.
 */
export default function MasterDashboardPage() {
  const { ready, user } = useRequireAuth();

  const [online, setOnline] = useState(true);
  const [requestState, setRequestState] = useState<'pending' | 'accepted' | 'declined'>('pending');
  const [countdown, setCountdown] = useState(42);

  useEffect(() => {
    if (!online || requestState !== 'pending' || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [online, requestState, countdown]);

  if (!ready || !user) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <div className="animate-pulse">
          <Logo size={44} />
        </div>
      </main>
    );
  }

  const showRequest = online && requestState === 'pending' && countdown > 0;
  const currentJobActions = (
    <div className="mt-2.5 flex gap-2">
      <span className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-sm bg-ink text-xs font-semibold text-ink-fg">
        <CheckIcon width={13} height={13} strokeWidth={2.4} />
        Bajarildi deb belgilash
      </span>
      <span className="flex h-9 w-9 items-center justify-center rounded-sm border border-border-primary text-content-secondary">
        <PhoneIcon width={15} height={15} />
      </span>
    </div>
  );

  const routeItems: TimelineItem[] =
    requestState === 'accepted'
      ? [
          ...ROUTE_BASE,
          {
            id: 'current',
            title: 'Kir yuvish mashinasini ulash — Chilonzor',
            time: 'hozir',
            meta: 'Bajarilmoqda · taxminiy to‘lov 140 000 so‘m',
            status: 'active',
            actions: currentJobActions,
          },
          {
            id: 'next',
            title: 'Quyilishni ta’mirlash — Yunusobod 4',
            time: '14:00',
            meta: 'Hozirgina qabul qilindi · to‘lov 165 000 so‘m',
            status: 'upcoming',
          },
        ]
      : [
          ...ROUTE_BASE,
          {
            id: 'current',
            title: 'Kir yuvish mashinasini ulash — Chilonzor',
            time: 'hozir',
            meta: 'Bajarilmoqda · taxminiy to‘lov 140 000 so‘m',
            status: 'active',
            actions: currentJobActions,
          },
          {
            id: 'next',
            title: 'Mikser almashtirish — Yakkasaroy',
            time: '14:00',
            meta: 'Tasdiqlangan · taxminiy to‘lov 130 000 so‘m',
            status: 'upcoming',
          },
        ];

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-background">
      {/* dark header */}
      <div className="bg-ink text-ink-fg">
        <div className="flex items-center gap-3 px-5 pb-4 pt-3">
          <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full bg-primary text-base font-bold text-white">
            BT
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-base font-bold">
              Bekzod T.
              <CheckIcon width={15} height={15} strokeWidth={2.6} className="text-primary" />
            </div>
            <div className="flex items-center gap-1 text-xs opacity-70">
              Santexnik · <Rating value="4.97" className="text-inherit" /> · 521 ish
            </div>
          </div>
          <OnlineToggle online={online} onChange={setOnline} />
        </div>

        <div className="grid grid-cols-3 gap-px border-t border-white/10 bg-white/10">
          <div className="bg-ink px-3 py-3.5 text-center">
            <div className="text-lg font-bold">340k</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wide opacity-65">Bugun, so&apos;m</div>
          </div>
          <div className="bg-ink px-3 py-3.5 text-center">
            <div className="text-lg font-bold">3 / 5</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wide opacity-65">Ishlar</div>
          </div>
          <div className="bg-ink px-3 py-3.5 text-center">
            <div className="text-lg font-bold text-primary">98%</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wide opacity-65">Qabul qilish</div>
          </div>
        </div>
      </div>

      {/* scroll area */}
      <div className="flex flex-1 flex-col gap-4 px-5 py-4">
        {showRequest && (
          <BookingRequestCard
            icon={<DropletIcon width={20} height={20} />}
            title="Quyilishni ta'mirlash — oshxona jo'mragi"
            meta="Yunusobod 4 · 1.4 km · Bugun 14:00–16:00"
            payout="165 000"
            countdown={countdown}
            onAccept={() => setRequestState('accepted')}
            onDecline={() => setRequestState('declined')}
          />
        )}
        {requestState === 'accepted' && (
          <div className="flex items-center gap-2.5 rounded-lg border border-success-fg bg-success-bg px-4 py-3.5">
            <CheckIcon width={18} height={18} strokeWidth={2.4} className="flex-none text-success-fg" />
            <span className="text-sm font-medium text-success-fg">
              Buyurtma qabul qilindi — bugungi marshrutga #4 sifatida, soat 14:00 ga qo&apos;shildi.
            </span>
          </div>
        )}

        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-lg font-bold tracking-tight">Bugungi marshrut</span>
          </div>
          <RouteTimeline items={routeItems} />
        </div>

        <div className="rounded-lg border border-border-tertiary bg-surface p-4 shadow-card">
          <div className="mb-3.5 flex items-baseline justify-between">
            <span className="text-sm font-semibold">Shu hafta</span>
            <span className="text-base font-bold">1,86 mln so&apos;m</span>
          </div>
          <WeekEarningsChart />
          <div className="mt-3.5 flex items-center gap-1.5 border-t border-border-tertiary pt-3 text-xs text-content-secondary">
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="var(--color-success-fg)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />
            </svg>
            +18% o&apos;tgan haftaga nisbatan · to&apos;lov har dushanba
          </div>
        </div>
      </div>

      {/* master-specific bottom nav (presentational) */}
      <div className="grid grid-cols-4 border-t border-border-tertiary bg-surface px-2 pb-[22px] pt-2.5">
        {NAV_ITEMS.map((item) => (
          <span
            key={item.label}
            className={`relative flex flex-col items-center gap-1 ${item.active ? 'text-primary' : 'text-content-muted'}`}
          >
            {item.icon}
            {item.badge && (
              <span className="absolute right-[26%] top-[-3px] flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
                {item.badge}
              </span>
            )}
            <span className={`text-[10px] ${item.active ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
