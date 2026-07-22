'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckIcon } from '@/components/ui/icons';
import { Logo } from '@/components/ui/logo';
import { Textarea } from '@/components/ui/textarea';
import { Role } from '@handly/contracts';
import { adminApi } from '@/lib/admin';
import { ApiError } from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';

export default function AdminVerificationsPage() {
  const { ready, user } = useRequireAuth(Role.ADMIN);
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'verifications'],
    queryFn: () => adminApi.verifications.list(),
    enabled: Boolean(user),
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      adminApi.verifications.decide(id, { approve, note: notes[id]?.trim() || undefined }),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'verifications'] });
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

  const items = data ?? [];

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
      <AppHeader title="Tasdiqlash so'rovlari" backHref="/admin" />

      <div className="flex flex-1 flex-col gap-3 px-5 py-5">
        {actionError && <Alert>{actionError}</Alert>}

        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="h-32 animate-pulse rounded-xl bg-background-secondary" />
          ))
        ) : isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <Alert>So&apos;rovlarni yuklab bo&apos;lmadi</Alert>
            <Button variant="outline" onClick={() => void refetch()}>
              Qayta urinish
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-background-secondary text-content-muted">
              <CheckIcon width={24} height={24} />
            </span>
            <p className="text-sm text-content-secondary">Ko&apos;rib chiqilishi kerak bo&apos;lgan so&apos;rovlar yo&apos;q</p>
          </div>
        ) : (
          items.map((v) => (
            <div key={v.id} className="flex flex-col gap-2 rounded-xl border border-border-tertiary bg-surface p-4 shadow-card">
              <p className="text-sm font-semibold text-content-primary">{v.masterPhone}</p>
              {v.note && <p className="text-xs text-content-secondary">{v.note}</p>}
              {/* Beta Blocker Sprint — a master's uploaded certification
                  photos, so this decision isn't made on note text alone. */}
              {v.certifications.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {v.certifications.map((c) => (
                    <a key={c.id} href={c.url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={c.url}
                        alt={c.caption ?? 'Sertifikat'}
                        className="h-20 w-20 rounded-md border border-border-secondary object-cover"
                      />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-content-muted">Hujjat yuklanmagan</p>
              )}
              <Textarea
                aria-label={`${v.masterPhone} uchun izoh`}
                placeholder="Izoh (rad etishda majburiy)"
                value={notes[v.id] ?? ''}
                onChange={(e) => setNotes((prev) => ({ ...prev, [v.id]: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  loading={decideMutation.isPending && decideMutation.variables?.id === v.id}
                  onClick={() => decideMutation.mutate({ id: v.id, approve: true })}
                >
                  Tasdiqlash
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  loading={decideMutation.isPending && decideMutation.variables?.id === v.id}
                  onClick={() => decideMutation.mutate({ id: v.id, approve: false })}
                >
                  Rad etish
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
