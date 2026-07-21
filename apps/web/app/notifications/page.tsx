'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { NotificationDto } from '@handly/contracts';
import { AppHeader } from '@/components/app-header';
import { BottomNav } from '@/components/nav/bottom-nav';
import { BellIcon } from '@/components/ui/icons';
import { Logo } from '@/components/ui/logo';
import { notificationsApi } from '@/lib/notifications';
import { useSocketEvent } from '@/lib/socket';
import { useRequireAuth } from '@/lib/use-require-auth';

export default function NotificationsPage() {
  const { ready, user } = useRequireAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(),
    enabled: Boolean(user),
  });

  useSocketEvent('notification:new', () => {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
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

  async function open(n: NotificationDto) {
    if (!n.readAt) {
      await notificationsApi.markRead(n.id);
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    }
    const orderId = n.data?.orderId;
    if (typeof orderId === 'string') router.push(`/orders/${orderId}`);
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
      <AppHeader title="Bildirishnomalar" />

      <div className="flex flex-1 flex-col gap-2 px-5 py-5">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="h-16 animate-pulse rounded-xl bg-background-secondary" />
          ))
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-background-secondary text-content-muted">
              <BellIcon width={26} height={26} />
            </span>
            <p className="text-sm text-content-secondary">
              Hozircha bildirishnomalar yo&apos;q. Buyurtmangiz holati o&apos;zgarganda shu yerda
              ko&apos;rinadi.
            </p>
          </div>
        ) : (
          items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => void open(n)}
              className={`flex flex-col gap-1 rounded-xl border p-4 text-left shadow-card ${
                n.readAt ? 'border-border-tertiary bg-surface' : 'border-primary bg-primary-soft'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-content-primary">{n.title}</span>
                {!n.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
              </div>
              <p className="text-xs text-content-secondary">{n.body}</p>
              <span className="text-[11px] text-content-muted">
                {new Date(n.createdAt).toLocaleString('uz-UZ', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </button>
          ))
        )}
      </div>

      <BottomNav />
    </main>
  );
}
