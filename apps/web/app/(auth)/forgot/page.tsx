'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { passwordResetSchema, uzPhoneSchema } from '@handly/contracts';
import { Alert } from '@/components/ui/alert';
import { AuthHeader } from '@/components/ui/auth-header';
import { Button } from '@/components/ui/button';
import { PhoneIcon } from '@/components/ui/icons';
import { OtpInput } from '@/components/ui/otp-input';
import { PasswordField } from '@/components/ui/password-field';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api';
import { authApi } from '@/lib/auth';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<'request' | 'reset'>('request');

  const [phone, setPhone] = useState('+998 ');
  const [normalizedPhone, setNormalizedPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = uzPhoneSchema.safeParse(phone);
    if (!parsed.success) {
      setError('Telefon raqami noto‘g‘ri');
      return;
    }
    setLoading(true);
    try {
      await authApi.requestReset(parsed.data);
      setNormalizedPhone(parsed.data);
      setNotice('Tasdiqlash kodi yuborildi');
      setStep('reset');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = passwordResetSchema.safeParse({ phone: normalizedPhone, code, newPassword });
    if (!parsed.success) {
      setError('Kod yoki parol noto‘g‘ri (parol kamida 8 ta belgi)');
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(parsed.data);
      router.replace('/login?reset=1');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Parolni tiklashda xatolik');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <AuthHeader
        title="Parolni tiklash"
        subtitle={
          step === 'request'
            ? 'Telefon raqamingizni kiriting'
            : 'Kodni kiriting va yangi parol o‘rnating'
        }
      />

      <div className="flex flex-col gap-4 rounded-xl border border-border-tertiary bg-surface p-5 shadow-card">
        {error && <Alert>{error}</Alert>}
        {notice && step === 'reset' && <Alert variant="success">{notice}</Alert>}

        {step === 'request' ? (
          <form className="flex flex-col gap-4" onSubmit={requestCode} noValidate>
            <TextField
              label="Telefon raqami"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+998 90 123 45 67"
              leading={<PhoneIcon width={18} height={18} />}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Button type="submit" size="lg" fullWidth loading={loading}>
              Kod yuborish
            </Button>
          </form>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={resetPassword} noValidate>
            <OtpInput value={code} onChange={setCode} autoFocus disabled={loading} />
            <PasswordField
              label="Yangi parol"
              placeholder="Kamida 8 ta belgi"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Button type="submit" size="lg" fullWidth loading={loading}>
              Parolni yangilash
            </Button>
          </form>
        )}

        <Link href="/login" className="text-center text-sm font-medium text-primary hover:underline">
          Kirish sahifasiga qaytish
        </Link>
      </div>
    </div>
  );
}
