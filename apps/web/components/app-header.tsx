import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeftIcon } from '@/components/ui/icons';
import { Logo } from '@/components/ui/logo';

/** Per docs/DESIGN_SYSTEM.md §1 — mark 30px + wordmark, top-left, links to /home. */
export function AppHeader({
  title,
  backHref,
  right,
}: {
  title?: string;
  backHref?: string;
  right?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-border-tertiary px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        {backHref ? (
          <Link
            href={backHref}
            aria-label="Orqaga"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-content-secondary hover:bg-background-secondary"
          >
            <ArrowLeftIcon width={18} height={18} />
          </Link>
        ) : (
          <Link href="/home" aria-label="Bosh sahifa" className="shrink-0">
            <Logo size={30} />
          </Link>
        )}
        {title ? (
          <h1 className="truncate text-base font-semibold text-content-primary">{title}</h1>
        ) : (
          !backHref && <span className="text-base font-semibold text-content-primary">Handly</span>
        )}
      </div>
      {right}
    </header>
  );
}
