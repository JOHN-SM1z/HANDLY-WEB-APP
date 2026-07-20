import { cn } from '@/lib/cn';
import { CheckIcon } from '@/components/ui/icons';

const STEPS = [
  { n: 1, label: 'Tavsif' },
  { n: 2, label: 'Vaqt' },
  { n: 3, label: 'Tasdiq' },
] as const;

/** Per docs/DESIGN_SYSTEM.md §5 — done=ink ✓, active=brand dot, todo=outlined, hairline connectors. */
export function WizardStepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-center gap-1.5 px-5 py-3">
      {STEPS.map((step, i) => {
        const state = step.n < current ? 'done' : step.n === current ? 'active' : 'todo';
        return (
          <div key={step.n} className="flex items-center gap-1.5">
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium',
                  state === 'done' && 'bg-ink text-ink-fg',
                  state === 'active' && 'bg-primary text-primary-fg',
                  state === 'todo' && 'border border-border-primary text-content-muted',
                )}
              >
                {state === 'done' ? <CheckIcon width={12} height={12} /> : step.n}
              </span>
              <span
                className={cn(
                  'text-[10px]',
                  state === 'todo' ? 'text-content-muted' : 'text-content-secondary',
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && <span className="mb-4 h-px w-6 bg-border-tertiary" />}
          </div>
        );
      })}
    </div>
  );
}
