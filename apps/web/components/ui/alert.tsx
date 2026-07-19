import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { AlertIcon, CheckIcon } from './icons';

type Variant = 'error' | 'success' | 'info';

const styles: Record<Variant, string> = {
  error: 'bg-danger-bg text-danger-fg',
  success: 'bg-success-bg text-success-fg',
  info: 'bg-info-bg text-info-fg',
};

export function Alert({ variant = 'error', children }: { variant?: Variant; children: ReactNode }) {
  return (
    <div
      className={cn('flex items-start gap-2 rounded-md px-3 py-2 text-sm', styles[variant])}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <span className="mt-0.5 shrink-0">
        {variant === 'success' ? (
          <CheckIcon width={16} height={16} />
        ) : (
          <AlertIcon width={16} height={16} />
        )}
      </span>
      <span>{children}</span>
    </div>
  );
}
