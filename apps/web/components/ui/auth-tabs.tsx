import Link from 'next/link';
import { cn } from '@/lib/cn';

export function AuthTabs({ active }: { active: 'login' | 'register' }) {
  const tab = 'flex-1 rounded-md py-2 text-center text-sm font-medium transition-colors';
  return (
    <div className="flex gap-1 rounded-lg bg-background-secondary p-1">
      <Link
        href="/login"
        className={cn(tab, active === 'login' ? 'bg-ink text-ink-fg' : 'text-content-secondary')}
      >
        Kirish
      </Link>
      <Link
        href="/register"
        className={cn(
          tab,
          active === 'register' ? 'bg-ink text-ink-fg' : 'text-content-secondary',
        )}
      >
        Ro&apos;yxatdan o&apos;tish
      </Link>
    </div>
  );
}
