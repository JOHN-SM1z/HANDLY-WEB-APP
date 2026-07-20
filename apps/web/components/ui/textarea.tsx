import { forwardRef, type TextareaHTMLAttributes, useId } from 'react';
import { cn } from '@/lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, rows = 4, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-content-primary">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        ref={ref}
        rows={rows}
        className={cn(
          'w-full resize-none rounded-md border bg-surface px-3 py-2.5 text-sm text-content-primary outline-none transition-colors placeholder:text-content-muted',
          'focus:border-primary focus:ring-2 focus:ring-focus',
          error ? 'border-danger-solid' : 'border-border-secondary',
          className,
        )}
        {...props}
      />
      {error ? (
        <p className="text-xs text-danger-fg">{error}</p>
      ) : hint ? (
        <p className="text-xs text-content-muted">{hint}</p>
      ) : null}
    </div>
  );
});
