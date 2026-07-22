import type { ReactNode } from 'react';

/** Small metric tile reused across /admin overview and /admin/analytics. No fabricated values — every caller passes real API data or an explicit "—". */
export function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border-tertiary bg-surface p-4 shadow-card">
      <p className="text-xl font-bold tabular-nums text-content-primary">{value}</p>
      <p className="mt-0.5 text-xs text-content-muted">{label}</p>
    </div>
  );
}
