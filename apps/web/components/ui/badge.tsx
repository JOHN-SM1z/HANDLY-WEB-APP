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
