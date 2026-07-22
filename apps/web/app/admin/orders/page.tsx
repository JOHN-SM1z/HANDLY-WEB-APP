'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { StatusBadge } from '@/components/admin/status-badge';
import { AppHeader } from '@/components/app-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ClipboardListIcon } from '@/components/ui/icons';
import { Logo } from '@/components/ui/logo';
import { OrderStatus, Role } from '@handly/contracts';
import { adminApi } from '@/lib/admin';
import { formatSomRange } from '@/lib/format';
import { useRequireAuth } from '@/lib/use-require-auth';

const STATUS_OPTIONS = [
  { value: '', label: 'Barchasi' },
  ...Object.values(OrderStatus).map((s) => ({ value: s, label: s })),
];

export default function AdminOrdersPage() {
  const { ready, user } = useRequireAuth(Role.ADMIN);
  const [status, setStatus] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'orders', status],
    queryFn: () => adminApi.orders.list({ status: (status || undefined) as never }),
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

  const orders = data?.items ?? [];

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
      <AppHeader title="Buyurtmalar" backHref="/admin" />

      <div className="flex flex-1 flex-col gap-3 px-5 py-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-content-primary">Holat bo&apos;yicha filtr</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-11 rounded-md border border-border-secondary bg-surface px-3 text-sm text-content-primary outline-none focus-within:border-primary focus-within:ring-2 focus-within:ring-focus"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="h-20 animate-pulse rounded-xl bg-background-secondary" />
          ))
        ) : isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <Alert>Buyurtmalarni yuklab bo&apos;lmadi</Alert>
            <Button variant="outline" onClick={() => void refetch()}>
              Qayta urinish
            </Button>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-background-secondary text-content-muted">
              <ClipboardListIcon width={26} height={26} />
            </span>
            <p className="text-sm text-content-secondary">Buyurtmalar topilmadi</p>
          </div>
        ) : (
          orders.map((order) => (
            <Link
              key={order.id}
              href={`/admin/orders/${order.id}`}
              className="flex flex-col gap-2 rounded-xl border border-border-tertiary bg-surface p-4 shadow-card"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-content-primary">
                  {order.categoryNameUz ?? 'Xizmat'} #{order.orderNo}
                </span>
                <StatusBadge status={order.status} />
              </div>
              <p className="text-xs text-content-secondary">
                Mijoz: {order.customerPhone}
                {order.masterPhone ? ` · Usta: ${order.masterPhone}` : ''}
              </p>
              {order.priceMin != null && order.priceMax != null && (
                <p className="text-xs font-medium tabular-nums text-content-primary">
                  {formatSomRange(order.priceMin, order.priceMax)}
                </p>
              )}
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
