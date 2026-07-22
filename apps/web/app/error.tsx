'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';

/** Next.js App Router error boundary — catches any unhandled render/data error below the root layout. */
export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
    // No-op if Sentry was never initialized (NEXT_PUBLIC_SENTRY_DSN unset).
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 px-6 text-center">
      <Logo size={44} />
      <div className="flex flex-col gap-1.5">
        <h1 className="text-base font-semibold text-content-primary">Nimadir xato ketdi</h1>
        <p className="max-w-xs text-sm text-content-secondary">
          Kutilmagan xatolik yuz berdi. Qayta urinib ko&apos;ring yoki bosh sahifaga qayting.
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Button fullWidth onClick={() => reset()}>
          Qayta urinish
        </Button>
        <Link href="/home">
          <Button variant="outline" fullWidth>
            Bosh sahifaga qaytish
          </Button>
        </Link>
      </div>
    </main>
  );
}
