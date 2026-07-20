import Link from 'next/link';
import type { ReactNode } from 'react';
import { SupportContacts } from '@/components/support-contacts';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">{children}</div>
      <footer className="mt-8 flex flex-col items-center gap-1.5 text-center text-xs text-content-muted">
        <p>
          Yordam kerakmi? <SupportContacts /> ·{' '}
          <Link href="/help" className="font-medium text-primary hover:underline">
            Yordam markazi
          </Link>
        </p>
        <p>© {new Date().getFullYear()} Handly · Toshkent</p>
      </footer>
    </main>
  );
}
