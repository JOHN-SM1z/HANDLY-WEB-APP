'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { StatusBadge } from '@/components/admin/status-badge';
import { AppHeader } from '@/components/app-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SearchIcon, UserIcon } from '@/components/ui/icons';
import { Logo } from '@/components/ui/logo';
import { TextField } from '@/components/ui/text-field';
import { Role } from '@handly/contracts';
import { adminApi } from '@/lib/admin';
import { useRequireAuth } from '@/lib/use-require-auth';

export default function AdminCustomersPage() {
  const { ready, user } = useRequireAuth(Role.ADMIN);
  const [phone, setPhone] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'customers', phone],
    queryFn: () => adminApi.users.list({ role: 'CUSTOMER', phone: phone || undefined }),
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

  const items = data?.items ?? [];

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
      <AppHeader title="Mijozlar" backHref="/admin" />

      <div className="flex flex-1 flex-col gap-3 px-5 py-5">
        <TextField
          label="Telefon raqami bo'yicha qidirish"
          placeholder="+998 90 ..."
          leading={<SearchIcon width={16} height={16} />}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="h-16 animate-pulse rounded-xl bg-background-secondary" />
          ))
        ) : isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <Alert>Mijozlarni yuklab bo&apos;lmadi</Alert>
            <Button variant="outline" onClick={() => void refetch()}>
              Qayta urinish
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-background-secondary text-content-muted">
              <UserIcon width={24} height={24} />
            </span>
            <p className="text-sm text-content-secondary">Mijozlar topilmadi</p>
          </div>
        ) : (
          items.map((c) => (
            <Link
              key={c.id}
              href={`/admin/customers/${c.id}`}
              className="flex items-center justify-between rounded-xl border border-border-tertiary bg-surface p-4 shadow-card"
            >
              <div>
                <p className="text-sm font-semibold text-content-primary">{c.phone}</p>
                {c.fullName && <p className="text-xs text-content-secondary">{c.fullName}</p>}
              </div>
              <StatusBadge status={c.status} />
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
