'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, Suspense, useState } from 'react';
import { registerSchema, Role } from '@handly/contracts';
import { Alert } from '@/components/ui/alert';
import { AuthHeader } from '@/components/ui/auth-header';
import { AuthTabs } from '@/components/ui/auth-tabs';
import { Button } from '@/components/ui/button';
import { PhoneIcon } from '@/components/ui/icons';
import { Logo } from '@/components/ui/logo';
import { PasswordField } from '@/components/ui/password-field';
import { TextField } from '@/components/ui/text-field';
import { cn } from '@/lib/cn';
import { ApiError } from '@/lib/api';
import { authApi } from '@/lib/auth';

type SignupRole = typeof Role.CUSTOMER | typeof Role.MASTER;

const roleOptions: Array<{ value: SignupRole; label: string; hint: string }> = [
  { value: Role.CUSTOMER, label: 'Mijoz', hint: 'Xizmat buyurtma qilaman' },
  { value: Role.MASTER, label: 'Usta', hint: 'Xizmat ko‘rsataman' },
];

function RegisterInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [role, setRole] = useState<SignupRole>(Role.CUSTOMER);
  const [phone, setPhone] = useState('+998 ');
  const [password, setPassword] = useState('');
  const [referredByCode, setReferredByCode] = useState(searchParams.get('ref') ?? '');
  const [errors, setErrors] = useState<{ phone?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = registerSchema.safeParse({
      phone,
      password,
      role,
      locale: 'uz',
      referredByCode: referredByCode.trim() || undefined,
    });
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setErrors({ phone: f.phone?.[0], password: f.password?.[0] });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const res = await authApi.register(parsed.data);
      router.push(
        `/verify?phone=${encodeURIComponent(res.phone)}&purpose=SIGNUP&resendIn=${res.resendIn}`,
      );
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Ro'yxatdan o'tishda xatolik");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <AuthHeader title="Hisob yaratish" subtitle="Handly'ga xush kelibsiz" />

      <div className="flex flex-col gap-4 rounded-xl border border-border-tertiary bg-surface p-5 shadow-card">
        <AuthTabs active="register" />

        {formError && <Alert>{formError}</Alert>}

        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-content-primary">Men kim sifatida?</span>
            <div className="grid grid-cols-2 gap-2">
              {roleOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  className={cn(
                    'flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
                    role === opt.value
                      ? 'border-primary bg-primary-soft'
                      : 'border-border-secondary bg-surface hover:bg-background-secondary',
                  )}
                  aria-pressed={role === opt.value}
                >
                  <span
                    className={cn(
                      'text-sm font-semibold',
                      role === opt.value ? 'text-primary-soft-fg' : 'text-content-primary',
                    )}
                  >
                    {opt.label}
                  </span>
                  <span className="text-xs text-content-secondary">{opt.hint}</span>
                </button>
              ))}
            </div>
          </div>

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
            placeholder="Kamida 8 ta belgi"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
          <TextField
            label="Referal kod (ixtiyoriy)"
            placeholder="Do'stingizning kodi"
            value={referredByCode}
            onChange={(e) => setReferredByCode(e.target.value)}
          />

          <Button type="submit" size="lg" fullWidth loading={loading}>
            Davom etish
          </Button>

          <p className="text-center text-xs leading-relaxed text-content-muted">
            Davom etish orqali siz Handly ommaviy ofertasi shartlariga rozilik bildirasiz.
          </p>
        </form>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[100dvh] items-center justify-center">
          <div className="animate-pulse">
            <Logo size={44} />
          </div>
        </main>
      }
    >
      <RegisterInner />
    </Suspense>
  );
}
