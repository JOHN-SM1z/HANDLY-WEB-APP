'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { StatusBadge } from '@/components/admin/status-badge';
import { AppHeader } from '@/components/app-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchIcon, UserIcon } from '@/components/ui/icons';
import { Logo } from '@/components/ui/logo';
import { TextField } from '@/components/ui/text-field';
import { Role } from '@handly/contracts';
import { adminApi } from '@/lib/admin';
import { useRequireAuth } from '@/lib/use-require-auth';

const SUBSCRIPTION_OPTIONS: Array<{ value: 'FREE' | 'PREMIUM' | ''; label: string }> = [
  { value: '', label: 'Barchasi' },
  { value: 'FREE', label: 'Free' },
  { value: 'PREMIUM', label: 'Premium' },
];

export default function AdminMastersPage() {
  const { ready, user } = useRequireAuth(Role.ADMIN);
  const [phone, setPhone] = useState('');
  const [subscriptionPlan, setSubscriptionPlan] = useState<'FREE' | 'PREMIUM' | ''>('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'masters', phone, subscriptionPlan],
    queryFn: () =>
      adminApi.users.list({
        role: 'MASTER',
        phone: phone || undefined,
        subscriptionPlan: subscriptionPlan || undefined,
      }),
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
      <AppHeader title="Ustalar" backHref="/admin" />

      <div className="flex flex-1 flex-col gap-3 px-5 py-5">
        <TextField
          label="Telefon raqami bo'yicha qidirish"
          placeholder="+998 90 ..."
          leading={<SearchIcon width={16} height={16} />}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-content-primary">Obuna turi</span>
          <select
            value={subscriptionPlan}
            onChange={(e) => setSubscriptionPlan(e.target.value as 'FREE' | 'PREMIUM' | '')}
            className="h-11 rounded-md border border-border-secondary bg-surface px-3 text-sm text-content-primary outline-none focus-within:border-primary focus-within:ring-2 focus-within:ring-focus"
          >
            {SUBSCRIPTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="h-16 animate-pulse rounded-xl bg-background-secondary" />
          ))
        ) : isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <Alert>Ustalarni yuklab bo&apos;lmadi</Alert>
            <Button variant="outline" onClick={() => void refetch()}>
              Qayta urinish
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-background-secondary text-content-muted">
              <UserIcon width={24} height={24} />
            </span>
            <p className="text-sm text-content-secondary">Ustalar topilmadi</p>
          </div>
        ) : (
          items.map((m) => (
            <Link
              key={m.id}
              href={`/admin/masters/${m.id}`}
              className="flex items-center justify-between rounded-xl border border-border-tertiary bg-surface p-4 shadow-card"
            >
              <div>
                <p className="text-sm font-semibold text-content-primary">{m.phone}</p>
                <p className="text-xs text-content-secondary">
                  T{m.trustTier ?? 0} · ★ {m.ratingAvg?.toFixed(2) ?? '0.00'} · {m.jobsDone ?? 0} ish
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge status={m.status} />
                {m.subscriptionPlan === 'PREMIUM' && <Badge variant="green">Premium</Badge>}
              </div>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
