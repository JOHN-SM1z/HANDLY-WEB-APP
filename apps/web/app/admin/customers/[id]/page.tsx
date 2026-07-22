'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { StatusBadge } from '@/components/admin/status-badge';
import { AppHeader } from '@/components/app-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { TextField } from '@/components/ui/text-field';
import { Role } from '@handly/contracts';
import { adminApi } from '@/lib/admin';
import { ApiError } from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';

export default function AdminCustomerDetailPage() {
  const { ready, user } = useRequireAuth(Role.ADMIN);
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'user', params.id],
    queryFn: () => adminApi.users.detail(params.id),
    enabled: Boolean(user),
  });

  const suspendMutation = useMutation({
    mutationFn: () => adminApi.users.suspend(params.id, reason.trim()),
    onSuccess: () => {
      setReason('');
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'user', params.id] });
    },
    onError: (err) => setActionError(err instanceof ApiError ? err.message : 'Xatolik yuz berdi'),
  });

  const restoreMutation = useMutation({
    mutationFn: () => adminApi.users.restore(params.id),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'user', params.id] });
    },
    onError: (err) => setActionError(err instanceof ApiError ? err.message : 'Xatolik yuz berdi'),
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
      <AppHeader title={data?.phone ?? 'Mijoz'} backHref="/admin/customers" />

      <div className="flex flex-1 flex-col gap-4 px-5 py-5">
        {isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <Alert>Ma&apos;lumotni yuklab bo&apos;lmadi</Alert>
            <Button variant="outline" onClick={() => void refetch()}>
              Qayta urinish
            </Button>
          </div>
        ) : isLoading || !data ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={i} className="h-16 animate-pulse rounded-xl bg-background-secondary" />
            ))}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-xl border border-border-tertiary bg-surface p-4 shadow-card">
              <div>
                <p className="text-sm font-semibold text-content-primary">{data.phone}</p>
                {data.fullName && <p className="text-xs text-content-secondary">{data.fullName}</p>}
                <p className="mt-1 text-xs text-content-muted">
                  Ro&apos;yxatdan o&apos;tgan: {new Date(data.createdAt).toLocaleDateString('uz-UZ')}
                </p>
              </div>
              <StatusBadge status={data.status} />
            </div>

            <div className="rounded-xl border border-border-tertiary bg-surface p-4 shadow-card">
              <p className="text-xs text-content-muted">Buyurtmalar soni</p>
              <p className="text-lg font-semibold text-content-primary">{data.ordersCount}</p>
            </div>

            {actionError && <Alert>{actionError}</Alert>}

            {data.status === 'SUSPENDED' ? (
              <Button
                variant="outline"
                loading={restoreMutation.isPending}
                onClick={() => restoreMutation.mutate()}
              >
                Blokdan chiqarish
              </Button>
            ) : (
              <div className="flex flex-col gap-2 rounded-xl border border-border-tertiary bg-surface p-4 shadow-card">
                <TextField
                  label="Bloklash sababi"
                  placeholder="Sababni kiriting"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <Button
                  variant="danger"
                  disabled={reason.trim().length < 3}
                  loading={suspendMutation.isPending}
                  onClick={() => suspendMutation.mutate()}
                >
                  Foydalanuvchini bloklash
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
