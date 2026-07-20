'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { CheckIcon } from '@/components/ui/icons';

/** Incoming-request composite, per docs/design/components/COMPONENTS.md "Booking / request card". */
export function BookingRequestCard({
  icon,
  title,
  meta,
  payout,
  countdown,
  onAccept,
  onDecline,
}: {
  icon: ReactNode;
  title: string;
  meta: string;
  payout: string;
  countdown: number;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border-[1.5px] border-primary bg-surface shadow-pop">
      <div className="flex items-center gap-2 bg-primary-soft px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-primary" />
        <span className="text-xs font-bold uppercase tracking-wide text-primary-soft-fg">
          Yangi buyurtma
        </span>
        <span className="ml-auto text-xs font-semibold text-primary-soft-fg">
          {countdown}s ichida tugaydi
        </span>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-md bg-primary-soft text-primary-soft-fg">
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{title}</div>
            <div className="mt-0.5 text-xs text-content-muted">{meta}</div>
          </div>
          <div className="flex-none text-right">
            <div className="text-base font-bold">{payout}</div>
            <div className="text-[10px] text-content-muted">sizning to&apos;lovingiz</div>
          </div>
        </div>
        <div className="flex gap-2.5">
          <Button type="button" variant="outline" className="flex-1" onClick={onDecline}>
            Rad etish
          </Button>
          <Button type="button" variant="primary" className="flex-[2] gap-1.5" onClick={onAccept}>
            <CheckIcon width={16} height={16} strokeWidth={2.6} />
            Qabul qilish
          </Button>
        </div>
      </div>
    </div>
  );
}
