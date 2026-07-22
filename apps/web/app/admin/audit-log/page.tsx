'use client';

import { useQuery } from '@tanstack/react-query';
import { AppHeader } from '@/components/app-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardListIcon } from '@/components/ui/icons';
import { Logo } from '@/components/ui/logo';
import { Role } from '@handly/contracts';
import { adminApi } from '@/lib/admin';
import { useRequireAuth } from '@/lib/use-require-auth';

export default function AdminAuditLogPage() {
  const { ready, user } = useRequireAuth(Role.ADMIN);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'audit-log'],
    queryFn: () => adminApi.auditLog.list(),
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
      <AppHeader title="Amallar tarixi" backHref="/admin" />

      <div className="flex flex-1 flex-col gap-2 px-5 py-5">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="h-14 animate-pulse rounded-xl bg-background-secondary" />
          ))
        ) : isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <Alert>Tarixni yuklab bo&apos;lmadi</Alert>
            <Button variant="outline" onClick={() => void refetch()}>
              Qayta urinish
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-background-secondary text-content-muted">
              <ClipboardListIcon width={24} height={24} />
            </span>
            <p className="text-sm text-content-secondary">Hozircha amallar yo&apos;q</p>
          </div>
        ) : (
          items.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col gap-1 rounded-xl border border-border-tertiary bg-surface p-3.5 shadow-card"
            >
              <div className="flex items-center justify-between gap-2">
                <Badge variant="gray">{entry.action}</Badge>
                <span className="text-xs text-content-muted">{new Date(entry.createdAt).toLocaleString('uz-UZ')}</span>
              </div>
              <p className="text-xs text-content-secondary">
                {entry.entityType}
                {entry.entityId ? ` · ${entry.entityId}` : ''}
              </p>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
