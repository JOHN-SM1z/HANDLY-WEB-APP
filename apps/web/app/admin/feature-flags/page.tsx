'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SparkleIcon } from '@/components/ui/icons';
import { Logo } from '@/components/ui/logo';
import { TextField } from '@/components/ui/text-field';
import { Role } from '@handly/contracts';
import { adminApi } from '@/lib/admin';
import { ApiError } from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';

export default function AdminFeatureFlagsPage() {
  const { ready, user } = useRequireAuth(Role.ADMIN);
  const queryClient = useQueryClient();
  const [newKey, setNewKey] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'feature-flags'],
    queryFn: () => adminApi.featureFlags.list(),
    enabled: Boolean(user),
  });

  const upsertMutation = useMutation({
    mutationFn: adminApi.featureFlags.upsert,
    onSuccess: () => {
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'feature-flags'] });
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : 'Xatolik yuz berdi'),
  });

  function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!newKey.trim()) return;
    upsertMutation.mutate(
      { key: newKey.trim(), enabled: false, description: newDescription.trim() || undefined },
      { onSuccess: () => { setNewKey(''); setNewDescription(''); } },
    );
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

  const items = data ?? [];

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
      <AppHeader title="Funksiya bayroqlari" backHref="/admin" />

      <div className="flex flex-1 flex-col gap-4 px-5 py-5">
        {formError && <Alert>{formError}</Alert>}

        <form onSubmit={onCreate} className="flex flex-col gap-2 rounded-xl border border-border-tertiary bg-surface p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-content-muted">Yangi bayroq</p>
          <TextField
            label="Kalit"
            placeholder="masalan: new_dispatch_algorithm"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
          />
          <TextField
            label="Tavsif (ixtiyoriy)"
            placeholder="Bu bayroq nima uchun kerak"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />
          <Button type="submit" variant="outline" disabled={!newKey.trim()} loading={upsertMutation.isPending}>
            Qo&apos;shish
          </Button>
        </form>

        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="h-16 animate-pulse rounded-xl bg-background-secondary" />
          ))
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Alert>Bayroqlarni yuklab bo&apos;lmadi</Alert>
            <Button variant="outline" onClick={() => void refetch()}>
              Qayta urinish
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-background-secondary text-content-muted">
              <SparkleIcon width={24} height={24} />
            </span>
            <p className="text-sm text-content-secondary">Hozircha bayroqlar yo&apos;q</p>
          </div>
        ) : (
          items.map((flag) => (
            <div
              key={flag.key}
              className="flex items-center justify-between gap-3 rounded-xl border border-border-tertiary bg-surface p-4 shadow-card"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-content-primary">{flag.key}</p>
                {flag.description && <p className="truncate text-xs text-content-secondary">{flag.description}</p>}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={flag.enabled}
                aria-label={`${flag.key} bayrog'ini ${flag.enabled ? "o'chirish" : 'yoqish'}`}
                onClick={() =>
                  upsertMutation.mutate({ key: flag.key, enabled: !flag.enabled, description: flag.description ?? undefined })
                }
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${flag.enabled ? 'bg-primary' : 'bg-background-secondary'}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform ${flag.enabled ? 'translate-x-5' : 'translate-x-0.5'}`}
                />
              </button>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
