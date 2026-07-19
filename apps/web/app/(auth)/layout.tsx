import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">{children}</div>
      <p className="mt-8 text-center text-xs text-content-muted">
        © {new Date().getFullYear()} Handly · Toshkent
      </p>
    </main>
  );
}
