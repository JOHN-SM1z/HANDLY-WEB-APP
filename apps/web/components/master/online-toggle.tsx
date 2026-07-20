'use client';

import { cn } from '@/lib/cn';

/** Online/offline pill, per docs/design/components/COMPONENTS.md "Toggle (online/offline)". */
export function OnlineToggle({
  online,
  onChange,
}: {
  online: boolean;
  onChange: (online: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!online)}
      aria-pressed={online}
      aria-label={online ? 'Oflaynga o‘tish' : 'Onlaynga o‘tish'}
      className="inline-flex items-center gap-2 rounded-full bg-white/10 py-1.5 pl-3 pr-2"
    >
      <span className={cn('text-xs font-semibold', online ? 'text-[#5ad46e]' : 'text-white/60')}>
        {online ? 'Onlayn' : 'Oflayn'}
      </span>
      <span
        className={cn(
          'relative h-[22px] w-[38px] rounded-full transition-colors duration-200',
          online ? 'bg-primary' : 'bg-white/25',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white transition-[left] duration-200',
            online ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </span>
    </button>
  );
}
