import { cn } from '@/lib/cn';

/**
 * Bare two-tone mark (stems + orange checkmark crossbar) — per docs/design/BRAND.md.
 * `inverse` swaps the stems to white for placement on a fixed dark/ink surface
 * (e.g. the Master Dashboard header), matching the ink-tile app-icon variant's
 * white-H-on-ink treatment rather than introducing a separate mono asset.
 */
export function Logo({
  size = 40,
  withWordmark = false,
  inverse = false,
  className,
}: {
  size?: number;
  withWordmark?: boolean;
  inverse?: boolean;
  className?: string;
}) {
  const stemFill = inverse ? 'var(--color-ink-fg)' : 'var(--color-ink)';
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden="true">
        <rect x="26" y="24" width="16" height="72" rx="3" fill={stemFill} />
        <rect x="78" y="24" width="16" height="72" rx="3" fill={stemFill} />
        <path
          d="M39 56 L54 69 L81 40"
          stroke="var(--color-primary)"
          strokeWidth="15.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {withWordmark && (
        <span
          className={cn(
            'text-lg font-semibold tracking-tight',
            inverse ? 'text-ink-fg' : 'text-content-primary',
          )}
        >
          Handly
        </span>
      )}
    </div>
  );
}
