'use client';

import { useMemo, useState } from 'react';
import {
  type OrderDto,
  ORDER_MAX_DAYS_AHEAD,
  ORDER_TIME_SLOTS,
  SERVICE_TIER_INFO,
  type ServiceTier,
  slotToUtcIso,
  tashkentNowHHMM,
  tashkentTodayDateStr,
  utcIsoToSlot,
} from '@handly/contracts';
import { ApiError } from '@/lib/api';
import { ordersApi } from '@/lib/orders';
import { formatSom } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertIcon, ArrowRightIcon, CalendarIcon, ClockIcon } from '@/components/ui/icons';

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, (d ?? 1) + days));
  return dt.toISOString().slice(0, 10);
}

const TIER_ORDER: ServiceTier[] = ['SCHEDULED', 'PRIORITY', 'EMERGENCY'];

export function StepSchedule({
  order,
  onBack,
  onNext,
}: {
  order: OrderDto | null;
  onBack: () => void;
  onNext: () => void;
}) {
  const today = tashkentTodayDateStr();
  const existingSlot = order?.scheduledAt ? utcIsoToSlot(order.scheduledAt) : null;

  const [tier, setTier] = useState<ServiceTier>(order?.serviceTier ?? 'SCHEDULED');
  const [date, setDate] = useState(existingSlot?.dateStr ?? today);
  const [slot, setSlot] = useState<string>(existingSlot?.slot ?? ORDER_TIME_SLOTS[0]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const maxDate = addDays(today, ORDER_MAX_DAYS_AHEAD);
  const availableSlots = useMemo(() => {
    if (date !== today) return ORDER_TIME_SLOTS;
    const now = tashkentNowHHMM();
    return ORDER_TIME_SLOTS.filter((s) => s > now);
  }, [date, today]);

  async function handleNext() {
    setError(null);
    if (!order) return;
    let scheduledAt: string | null = null;
    if (tier === 'SCHEDULED') {
      if (!availableSlots.includes(slot as (typeof ORDER_TIME_SLOTS)[number])) {
        setError("Bu vaqt band yoki o'tib ketgan. Boshqa vaqt tanlang");
        return;
      }
      scheduledAt = slotToUtcIso(date, slot);
    }

    setSaving(true);
    try {
      await ordersApi.update(order.id, { serviceTier: tier, scheduledAt });
      await ordersApi.diagnose(order.id);
      onNext();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-5 px-5 py-5">
      {error && <Alert>{error}</Alert>}

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">
          Xizmat rejimi
        </p>
        <div className="flex flex-col gap-2">
          {TIER_ORDER.map((t) => {
            const info = SERVICE_TIER_INFO[t];
            const active = tier === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTier(t)}
                className={cn(
                  'flex flex-col gap-1 rounded-xl border px-4 py-3 text-left transition-colors',
                  active ? 'border-primary bg-primary-soft' : 'border-border-secondary bg-surface',
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'text-sm font-semibold',
                      active ? 'text-primary-soft-fg' : 'text-content-primary',
                    )}
                  >
                    {info.labelUz}
                  </span>
                  {info.platformFee > 0 && (
                    <span className="text-xs font-medium text-content-secondary">
                      +{formatSom(info.platformFee)}
                    </span>
                  )}
                </div>
                <span className="text-xs text-content-secondary">{info.etaUz}</span>
              </button>
            );
          })}
        </div>
      </div>

      {tier === 'SCHEDULED' ? (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-content-muted">
            <CalendarIcon width={13} height={13} /> Sana va vaqt
          </p>
          <input
            type="date"
            aria-label="Sana"
            value={date}
            min={today}
            max={maxDate}
            onChange={(e) => setDate(e.target.value)}
            className="mb-3 w-full rounded-md border border-border-secondary bg-surface px-3 py-2.5 text-sm text-content-primary outline-none focus:border-primary focus:ring-2 focus:ring-focus"
          />
          {availableSlots.length === 0 ? (
            <p className="text-sm text-content-secondary">
              Bugun uchun barcha vaqtlar o&apos;tib ketgan. Boshqa kunni tanlang.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {ORDER_TIME_SLOTS.map((s) => {
                const disabled = !availableSlots.includes(s);
                const active = slot === s;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSlot(s)}
                    className={cn(
                      'rounded-md px-3.5 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-ink text-ink-fg'
                        : disabled
                          ? 'cursor-not-allowed bg-background-secondary text-content-muted line-through'
                          : 'border border-border-secondary text-content-primary hover:bg-background-secondary',
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div
          className={cn(
            'flex items-start gap-2 rounded-xl border p-3',
            tier === 'EMERGENCY' ? 'border-danger-solid bg-danger-bg' : 'border-warning-bg bg-warning-bg',
          )}
        >
          <AlertIcon
            width={16}
            height={16}
            className={cn('mt-0.5 shrink-0', tier === 'EMERGENCY' ? 'text-danger-fg' : 'text-warning-fg')}
          />
          <div>
            <p
              className={cn(
                'flex items-center gap-1 text-sm font-medium',
                tier === 'EMERGENCY' ? 'text-danger-fg' : 'text-warning-fg',
              )}
            >
              <ClockIcon width={13} height={13} /> {SERVICE_TIER_INFO[tier].etaUz}
            </p>
            <p className={cn('mt-1 text-xs leading-relaxed', tier === 'EMERGENCY' ? 'text-danger-fg' : 'text-warning-fg')}>
              Narx oshishi haqida ogohlantiramiz: bu rejimda xizmat narxi yuqori bo&apos;ladi
              (+{formatSom(SERVICE_TIER_INFO[tier].platformFee)} platforma haqi).
            </p>
          </div>
        </div>
      )}

      <div className="mt-auto flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Orqaga
        </Button>
        <Button loading={saving} onClick={() => void handleNext()} className="flex-[2]">
          Keyingisi <ArrowRightIcon width={16} height={16} />
        </Button>
      </div>
    </div>
  );
}
