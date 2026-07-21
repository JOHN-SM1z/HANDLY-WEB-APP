'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { AppHeader } from '@/components/app-header';
import { CategoryIcon } from '@/components/category-icon';
import { BottomNav } from '@/components/nav/bottom-nav';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { BellIcon } from '@/components/ui/icons';
import { Logo } from '@/components/ui/logo';
import { api } from '@/lib/api';
import { categoriesApi } from '@/lib/categories';
import { useRequireAuth } from '@/lib/use-require-auth';

interface MeResponse {
  phone: string;
  role: 'CUSTOMER' | 'MASTER' | 'ADMIN';
}

export default function HomePage() {
  const { ready, user } = useRequireAuth();

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<MeResponse>('/me'),
    enabled: Boolean(user),
  });
  const {
    data: categories,
    isLoading: categoriesLoading,
    isError: categoriesError,
    refetch: refetchCategories,
  } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
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

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
      <AppHeader
        title="Assalomu alaykum 👋"
        right={
          <Link
            href="/notifications"
            aria-label="Bildirishnomalar"
            className="flex h-9 w-9 items-center justify-center rounded-full text-content-secondary hover:bg-background-secondary"
          >
            <BellIcon width={19} height={19} />
          </Link>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-5 py-5">
        <p className="text-sm text-content-secondary">
          {me?.phone ?? user.phone} — muammoingizni tasvirlab bering, biz mos ustani topamiz.
        </p>

        <Link href="/orders/new">
          <Button size="lg" fullWidth>
            + Yangi buyurtma yaratish
          </Button>
        </Link>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wide text-content-muted">
              Xizmatlar
            </h2>
          </div>

          {categoriesLoading ? (
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={i} className="h-20 animate-pulse rounded-xl bg-background-secondary" />
              ))}
            </div>
          ) : categoriesError ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Alert>Xizmatlar ro&apos;yxatini yuklab bo&apos;lmadi</Alert>
              <Button variant="outline" size="sm" onClick={() => void refetchCategories()}>
                Qayta urinish
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {categories?.map((c) => (
                <Link
                  key={c.id}
                  href={`/orders/new?category=${c.slug}`}
                  className="flex flex-col items-center gap-2 rounded-xl border border-border-tertiary bg-surface px-2 py-4 text-center shadow-card transition-colors hover:bg-background-secondary"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <CategoryIcon iconKey={c.iconKey} />
                  </span>
                  <span className="text-xs font-medium leading-tight text-content-primary">
                    {c.nameUz}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border-tertiary bg-background-secondary p-4">
          <p className="text-sm font-medium text-content-primary">Qanday ishlaydi?</p>
          <p className="mt-1 text-sm leading-relaxed text-content-secondary">
            Xizmat turini tanlang, muammoni rasm bilan tasvirlab bering — AI bepul tashxis
            qo&apos;yadi va narx oralig&apos;ini hisoblaydi. Keyin bitta tasdiqlangan ustani
            topamiz.
          </p>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}
