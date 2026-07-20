'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { AppHeader } from '@/components/app-header';
import { BottomNav } from '@/components/nav/bottom-nav';
import { OrderStatusBadge } from '@/components/order/order-status-badge';
import { Button } from '@/components/ui/button';
import { ClipboardListIcon } from '@/components/ui/icons';
import { Logo } from '@/components/ui/logo';
import { formatSomRange } from '@/lib/format';
import { ordersApi } from '@/lib/orders';
import { useRequireAuth } from '@/lib/use-require-auth';

export default function OrdersPage() {
  const { ready, user } = useRequireAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => ordersApi.list(),
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
      <AppHeader title="Buyurtmalarim" />

      <div className="flex flex-1 flex-col gap-3 px-5 py-5">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="h-20 animate-pulse rounded-xl bg-background-secondary" />
          ))
        ) : orders.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-background-secondary text-content-muted">
              <ClipboardListIcon width={26} height={26} />
            </span>
            <p className="text-sm text-content-secondary">
              Hozircha buyurtmalar yo&apos;q
            </p>
            <Link href="/orders/new">
              <Button>+ Yangi buyurtma yaratish</Button>
            </Link>
          </div>
        ) : (
          orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="flex flex-col gap-2 rounded-xl border border-border-tertiary bg-surface p-4 shadow-card"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-content-primary">
                  {order.categoryName ?? 'Xizmat'} #{order.orderNo}
                </span>
                <OrderStatusBadge status={order.status} />
              </div>
              <p className="line-clamp-1 text-xs text-content-secondary">{order.description}</p>
              {order.priceMin != null && order.priceMax != null && (
                <p className="text-xs font-medium tabular-nums text-content-primary">
                  {formatSomRange(order.priceMin, order.priceMax)}
                </p>
              )}
            </Link>
          ))
        )}
      </div>

      <BottomNav />
    </main>
  );
}
