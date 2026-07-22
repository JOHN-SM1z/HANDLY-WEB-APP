'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { StatCard } from '@/components/admin/stat-card';
import { StatusBadge } from '@/components/admin/status-badge';
import { AppHeader } from '@/components/app-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SearchIcon } from '@/components/ui/icons';
import { Logo } from '@/components/ui/logo';
import { TextField } from '@/components/ui/text-field';
import { Role } from '@handly/contracts';
import { adminApi } from '@/lib/admin';
import { ApiError } from '@/lib/api';
import { formatSom } from '@/lib/format';
import { useRequireAuth } from '@/lib/use-require-auth';

export default function AdminSupportPage() {
  const { ready, user } = useRequireAuth(Role.ADMIN);
  const [phoneInput, setPhoneInput] = useState('');
  const [searchedPhone, setSearchedPhone] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'support', searchedPhone],
    queryFn: () => adminApi.support.lookup(searchedPhone),
    enabled: Boolean(user) && searchedPhone.length > 0,
    retry: false,
  });

  function onSearch(e: FormEvent) {
    e.preventDefault();
    if (phoneInput.trim()) setSearchedPhone(phoneInput.trim());
  }

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
      <AppHeader title="Qo'llab-quvvatlash" backHref="/admin" />

      <div className="flex flex-1 flex-col gap-4 px-5 py-5">
        <form onSubmit={onSearch} className="flex items-end gap-2">
          <div className="flex-1">
            <TextField
              label="Telefon raqami"
              placeholder="+998 90 123 45 67"
              leading={<SearchIcon width={16} height={16} />}
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={!phoneInput.trim()}>
            Qidirish
          </Button>
        </form>

        {searchedPhone && isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={i} className="h-16 animate-pulse rounded-xl bg-background-secondary" />
            ))}
          </div>
        ) : searchedPhone && isError ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Alert>{error instanceof ApiError ? error.message : "Foydalanuvchi topilmadi"}</Alert>
            <Button variant="outline" onClick={() => void refetch()}>
              Qayta urinish
            </Button>
          </div>
        ) : data ? (
          <>
            <div className="flex items-center justify-between rounded-xl border border-border-tertiary bg-surface p-4 shadow-card">
              <div>
                <Link href={`/admin/${data.user.role === 'MASTER' ? 'masters' : 'customers'}/${data.user.id}`} className="text-sm font-semibold text-primary underline-offset-2 hover:underline">
                  {data.user.phone}
                </Link>
                {data.user.fullName && <p className="text-xs text-content-secondary">{data.user.fullName}</p>}
              </div>
              <StatusBadge status={data.user.status} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link
                href={`/admin/orders?${data.user.role === 'MASTER' ? 'masterId' : 'customerId'}=${data.user.id}`}
              >
                <StatCard label="Buyurtmalar" value={data.user.ordersCount} />
              </Link>
              <StatCard label="Referal cashback" value={formatSom(data.referrals?.totalCashbackEarned ?? 0)} />
            </div>

            {data.penalties && (
              <StatCard label="Faol jarima ballari" value={data.penalties.activePoints} />
            )}

            <section>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">
                To&apos;lovlar tarixi
              </h2>
              {data.payments.length === 0 ? (
                <p className="text-sm text-content-secondary">To&apos;lovlar topilmadi</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.payments.map((p) => (
                    <div key={p.id} className="flex flex-col gap-1 rounded-lg bg-background-secondary px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-content-secondary">{p.method}</span>
                        <StatusBadge status={p.status} />
                        <span className="text-xs font-medium text-content-primary">{formatSom(p.amount)}</span>
                      </div>
                      {p.failureReason && <p className="text-xs text-danger-fg">Sabab: {p.failureReason}</p>}
                      {p.resolutionNote && (
                        <p className="text-xs text-content-muted">Hal qilindi: {p.resolutionNote}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {data.penalties && data.penalties.items.length > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">
                  Jarima tarixi
                </h2>
                <div className="flex flex-col gap-2">
                  {data.penalties.items.map((p, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <div key={i} className="flex items-center justify-between rounded-lg bg-background-secondary px-3 py-2">
                      <span className="text-xs text-content-secondary">{p.eventType}</span>
                      <span className="text-xs font-medium text-content-primary">{p.points} ball</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : searchedPhone ? null : (
          <p className="py-8 text-center text-sm text-content-secondary">
            Foydalanuvchi haqida to&apos;liq ma&apos;lumot olish uchun telefon raqamini kiriting
          </p>
        )}
      </div>
    </main>
  );
}
