'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/cn';
import { notificationsApi } from '@/lib/notifications';
import { useSocketEvent } from '@/lib/socket';
import { BellIcon, ClipboardListIcon, HomeIcon, PlusIcon, UserIcon } from '@/components/ui/icons';

const items = [
  { href: '/home', label: 'Bosh', icon: HomeIcon },
  { href: '/orders', label: 'Buyurtmalar', icon: ClipboardListIcon },
  { href: '/notifications', label: 'Bildirishnoma', icon: BellIcon },
  { href: '/profile', label: 'Profil', icon: UserIcon },
] as const;

/** Per docs/DESIGN_SYSTEM.md §5 — 5 slots, center = raised ink "+" (new order). */
export function BottomNav() {
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationsApi.unreadCount,
  });
  useSocketEvent('notification:new', () => {
    void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
  });

  return (
    <nav
      className="sticky bottom-0 z-10 flex items-stretch border-t border-border-tertiary bg-surface pb-[env(safe-area-inset-bottom)]"
      aria-label="Asosiy navigatsiya"
    >
      {items.slice(0, 2).map((item) => (
        <NavItem key={item.href} {...item} active={pathname.startsWith(item.href)} />
      ))}

      <Link
        href="/orders/new"
        className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5"
        aria-label="Yangi buyurtma"
      >
        <span className="-mt-4 flex h-10 w-10 items-center justify-center rounded-full bg-ink text-ink-fg shadow-pop">
          <PlusIcon width={18} height={18} />
        </span>
        <span className="text-[10px] font-medium text-content-secondary">Buyurtma</span>
      </Link>

      {items.slice(2).map((item) => (
        <NavItem
          key={item.href}
          {...item}
          active={pathname.startsWith(item.href)}
          badge={item.href === '/notifications' ? data?.count : undefined}
        />
      ))}
    </nav>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  icon: typeof HomeIcon;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-content-secondary',
        active && 'text-primary',
      )}
      aria-current={active ? 'page' : undefined}
    >
      <span className="relative">
        <Icon width={19} height={19} />
        {Boolean(badge) && badge! > 0 && (
          <span
            className="absolute -right-1.5 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white"
            aria-label={`${badge} o'qilmagan bildirishnoma`}
          >
            {badge! > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}
