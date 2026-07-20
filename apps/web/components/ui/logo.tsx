import { cn } from '@/lib/cn';

/** Bare two-tone mark (ink stems + orange checkmark crossbar) — per docs/design/BRAND.md. */
export function Logo({
  size = 40,
  withWordmark = false,
  className,
}: {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden="true">
        <rect x="26" y="24" width="16" height="72" rx="3" fill="var(--color-ink)" />
        <rect x="78" y="24" width="16" height="72" rx="3" fill="var(--color-ink)" />
        <path
          d="M39 56 L54 69 L81 40"
          stroke="var(--color-primary)"
          strokeWidth="15.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {withWordmark && (
        <span className="text-lg font-semibold tracking-tight text-content-primary">Handly</span>
      )}
    </div>
  );
}
