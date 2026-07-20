import type { ReactNode } from 'react';
import { CheckIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

export type TimelineStatus = 'done' | 'active' | 'upcoming';

export interface TimelineItem {
  id: string;
  title: string;
  time: string;
  meta: string;
  status: TimelineStatus;
  actions?: ReactNode;
}

/** Route/status timeline, per docs/design/components/COMPONENTS.md "Timeline (route/status)". */
export function RouteTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <div className="flex flex-col">
      {items.map((item, i) => (
        <div key={item.id} className="flex gap-3">
          <div className="flex w-5 flex-none flex-col items-center">
            {item.status === 'done' && (
              <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-success-bg text-success-fg">
                <CheckIcon width={11} height={11} strokeWidth={3} />
              </span>
            )}
            {item.status === 'active' && (
              <span
                className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-primary"
                style={{ boxShadow: '0 0 0 4px var(--color-primary-soft)' }}
              >
                <span className="h-[7px] w-[7px] rounded-full bg-white" />
              </span>
            )}
            {item.status === 'upcoming' && (
              <span className="h-5 w-5 flex-none rounded-full border-2 border-border-primary bg-surface" />
            )}
            {i < items.length - 1 && <span className="my-1 w-0.5 flex-1 bg-border-secondary" />}
          </div>
          <div className={cn('flex-1', i === items.length - 1 ? 'pb-0' : 'pb-3.5')}>
            <div
              className={cn(
                'rounded-md border p-3',
                item.status === 'done' && 'border-border-tertiary bg-surface opacity-65',
                item.status === 'active' && 'border-[1.5px] border-primary bg-surface shadow-card',
                item.status === 'upcoming' && 'border-border-tertiary bg-surface',
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className={cn('text-sm font-semibold', item.status === 'done' && 'line-through')}>
                  {item.title}
                </span>
                <span
                  className={cn(
                    'shrink-0 text-xs',
                    item.status === 'active' ? 'font-semibold text-primary' : 'text-content-muted',
                  )}
                >
                  {item.time}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-content-muted">{item.meta}</div>
              {item.actions}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
