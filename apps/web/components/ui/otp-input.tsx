'use client';

import { type ClipboardEvent, type KeyboardEvent, useRef } from 'react';
import { cn } from '@/lib/cn';

export function OtpInput({
  length = 6,
  value,
  onChange,
  autoFocus = false,
  disabled = false,
}: {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const chars = value.split('');

  function setChar(index: number, ch: string) {
    const next = value.padEnd(length, ' ').split('');
    next[index] = ch || ' ';
    onChange(next.join('').replace(/ /g, '').slice(0, length));
  }

  function handleChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1);
    if (!digit) return;
    // Rebuild deterministically so typing always advances correctly.
    const arr = Array.from({ length }, (_, i) => chars[i] ?? '');
    arr[index] = digit;
    onChange(arr.join('').slice(0, length));
    if (index < length - 1) refs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (chars[index]) {
        setChar(index, '');
      } else if (index > 0) {
        refs.current[index - 1]?.focus();
        setChar(index - 1, '');
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!digits) return;
    onChange(digits);
    refs.current[Math.min(digits.length, length - 1)]?.focus();
  }

  return (
    <div className="flex justify-center gap-2" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          value={chars[i] ?? ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          aria-label={`Kod raqami ${i + 1}`}
          className={cn(
            'h-12 w-11 rounded-md border bg-surface text-center text-lg font-semibold text-content-primary outline-none transition-colors',
            'focus:border-primary focus:ring-2 focus:ring-focus',
            chars[i] ? 'border-primary' : 'border-border-secondary',
          )}
        />
      ))}
    </div>
  );
}
