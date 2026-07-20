import { ArrowLeftIcon } from '@/components/ui/icons';

export function WizardHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-border-tertiary px-5 py-4">
      <button
        type="button"
        onClick={onBack}
        aria-label="Orqaga"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-content-secondary hover:bg-background-secondary"
      >
        <ArrowLeftIcon width={18} height={18} />
      </button>
      <h1 className="truncate text-base font-semibold text-content-primary">{title}</h1>
    </div>
  );
}
