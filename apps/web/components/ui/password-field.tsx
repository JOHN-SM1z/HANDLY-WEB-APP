'use client';

import { forwardRef, useState } from 'react';
import { EyeIcon, EyeOffIcon, LockIcon } from './icons';
import { TextField, type TextFieldProps } from './text-field';

export const PasswordField = forwardRef<
  HTMLInputElement,
  Omit<TextFieldProps, 'type' | 'leading' | 'trailing'>
>(function PasswordField(props, ref) {
  const [show, setShow] = useState(false);
  return (
    <TextField
      ref={ref}
      type={show ? 'text' : 'password'}
      leading={<LockIcon width={18} height={18} />}
      trailing={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="text-content-muted transition-colors hover:text-content-secondary"
          aria-label={show ? 'Parolni yashirish' : "Parolni ko'rsatish"}
        >
          {show ? <EyeOffIcon width={18} height={18} /> : <EyeIcon width={18} height={18} />}
        </button>
      }
      {...props}
    />
  );
});
