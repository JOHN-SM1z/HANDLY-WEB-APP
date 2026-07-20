const DAYS = [
  { label: 'Dush', pct: 45 },
  { label: 'Sesh', pct: 70 },
  { label: 'Chor', pct: 38 },
  { label: 'Pay', pct: 85 },
  { label: 'Jum', pct: 60 },
  { label: 'Shan', pct: 100 },
  { label: 'Yak', pct: 12 },
];

/** Static weekly-earnings bar chart for the presentational Master Dashboard. */
export function WeekEarningsChart({ highlightIndex = 5 }: { highlightIndex?: number }) {
  return (
    <div className="flex h-[72px] items-end gap-2">
      {DAYS.map((d, i) => (
        <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
          <div
            className="w-full rounded-t"
            style={{
              height: `${d.pct}%`,
              background: i === highlightIndex ? 'var(--color-primary)' : 'var(--color-border-secondary)',
            }}
          />
          <span
            className="text-[9px]"
            style={{
              color: i === highlightIndex ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              fontWeight: i === highlightIndex ? 700 : 400,
            }}
          >
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}
