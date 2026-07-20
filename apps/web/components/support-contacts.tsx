import { SUPPORT_PHONES } from '@/lib/support';
import { cn } from '@/lib/cn';
import { PhoneIcon } from './ui/icons';

/** Tappable support numbers (tel: links). variant="inline" for footers, "card" for help surfaces. */
export function SupportContacts({
  variant = 'inline',
  className,
}: {
  variant?: 'inline' | 'card';
  className?: string;
}) {
  if (variant === 'card') {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {SUPPORT_PHONES.map((p) => (
          <a
            key={p.tel}
            href={`tel:${p.tel}`}
            className="flex items-center gap-3 rounded-lg border border-border-tertiary bg-surface px-4 py-3 shadow-card transition-colors hover:bg-background-secondary"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary-soft-fg">
              <PhoneIcon width={18} height={18} />
            </span>
            <span className="text-sm font-medium tabular-nums text-content-primary">
              {p.display}
            </span>
          </a>
        ))}
      </div>
    );
  }

  return (
    <span className={cn('inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1', className)}>
      {SUPPORT_PHONES.map((p) => (
        <a
          key={p.tel}
          href={`tel:${p.tel}`}
          className="whitespace-nowrap font-medium tabular-nums text-primary hover:underline"
        >
          {p.display}
        </a>
      ))}
    </span>
  );
}
