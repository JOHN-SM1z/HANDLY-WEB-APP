import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'gray' | 'blue' | 'green' | 'amber' | 'red';

const styles: Record<Variant, string> = {
  gray: 'bg-background-secondary text-content-secondary',
  blue: 'bg-info-bg text-info-fg',
  green: 'bg-success-bg text-success-fg',
  amber: 'bg-warning-bg text-warning-fg',
  red: 'bg-danger-bg text-danger-fg',
};

export function Badge({
  variant = 'gray',
  icon,
  children,
  className,
}: {
  variant?: Variant;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
        styles[variant],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** Per docs/design/components/COMPONENTS.md — pill tag for "Verified" and promo labels. */
export function Chip({ icon, children, className }: { icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary-soft-fg',
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** Filled star + numeric value, per docs/design/components/COMPONENTS.md. */
export function Rating({ value, className }: { value: number | string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-sm font-semibold text-content-primary', className)}>
      <svg viewBox="0 0 24 24" width={14} height={14} fill="var(--color-star)" aria-hidden="true">
        <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8-6.1-3.5-6.1 3.5 1.4-6.8L2.2 9.1l6.9-.8z" />
      </svg>
      {value}
    </span>
  );
}
