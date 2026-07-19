'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { loginSchema } from '@handly/contracts';
import { Alert } from '@/components/ui/alert';
import { AuthHeader } from '@/components/ui/auth-header';
import { AuthTabs } from '@/components/ui/auth-tabs';
import { Button } from '@/components/ui/button';
import { PhoneIcon } from '@/components/ui/icons';
import { PasswordField } from '@/components/ui/password-field';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api';
import { authApi, isAuthResult } from '@/lib/auth';
import { useSession } from '@/lib/session';

export default function LoginPage() {
  const router = useRouter();
  const setSession = useSession((s) => s.setSession);

  const [phone, setPhone] = useState('+998 ');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ phone?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = loginSchema.safeParse({ phone, password });
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setErrors({ phone: f.phone?.[0], password: f.password?.[0] });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const res = await authApi.login(parsed.data);
      if (isAuthResult(res)) {
        setSession(res.user, res.tokens.accessToken);
        router.replace('/home');
      } else {
        // Unverified account — send them to phone verification.
        router.push(
          `/verify?phone=${encodeURIComponent(res.phone)}&purpose=SIGNUP&resendIn=${res.resendIn}`,
        );
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Kirishda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <AuthHeader title="Handly" subtitle="Uyingiz uchun ishonchli ustalar" />

      <div className="flex flex-col gap-4 rounded-xl border border-border-tertiary bg-surface p-5 shadow-card">
        <AuthTabs active="login" />

        {formError && <Alert>{formError}</Alert>}

        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <TextField
            label="Telefon raqami"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+998 90 123 45 67"
            leading={<PhoneIcon width={18} height={18} />}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={errors.phone}
          />
          <PasswordField
            label="Parol"
            placeholder="Parolingiz"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />

          <div className="text-right">
            <Link href="/forgot" className="text-sm font-medium text-primary hover:underline">
              Parolingizni unutdingizmi?
            </Link>
          </div>

          <Button type="submit" size="lg" fullWidth loading={loading}>
            Kirish
          </Button>
        </form>
      </div>
    </div>
  );
}
