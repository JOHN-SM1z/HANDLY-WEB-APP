import { cn } from '@/lib/cn';

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
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="var(--color-ink)" />
        <path
          d="M10 22V10M10 16h7M17 22V10"
          stroke="var(--color-ink-fg)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="22" cy="11.5" r="2.4" fill="var(--color-primary)" />
      </svg>
      {withWordmark && (
        <span className="text-lg font-semibold tracking-tight text-content-primary">Handly</span>
      )}
    </div>
  );
}
