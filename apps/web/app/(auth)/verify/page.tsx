'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { type OtpPurpose, otpVerifySchema } from '@handly/contracts';
import { Alert } from '@/components/ui/alert';
import { AuthHeader } from '@/components/ui/auth-header';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { OtpInput } from '@/components/ui/otp-input';
import { ApiError } from '@/lib/api';
import { authApi } from '@/lib/auth';
import { useSession } from '@/lib/session';

function VerifyInner() {
  const router = useRouter();
  const params = useSearchParams();
  const setSession = useSession((s) => s.setSession);

  const phone = params.get('phone') ?? '';
  const purpose = (params.get('purpose') as OtpPurpose) ?? 'SIGNUP';

  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(Number(params.get('resendIn') ?? 45));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!phone) router.replace('/login');
  }, [phone, router]);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  async function verify() {
    if (submittingRef.current) return;
    const parsed = otpVerifySchema.safeParse({ phone, code, purpose });
    if (!parsed.success) {
      setError('Kod 6 ta raqamdan iborat bo‘lishi kerak');
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.verifyOtp(parsed.data);
      setSession(res.user, res.tokens.accessToken);
      router.replace('/home');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Kod tasdiqlanmadi');
      setCode('');
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  // Auto-submit once six digits are entered.
  useEffect(() => {
    if (code.length === 6 && !submittingRef.current) void verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function resend() {
    setError(null);
    try {
      const res = await authApi.requestOtp({ phone, purpose });
      setSeconds(res.resendIn);
      setCode('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Kodni qayta yuborishda xatolik');
    }
  }

  const maskedPhone = phone.replace(/(\+998 ?\d{2} ?\d{3}).*(\d{2})$/, '$1 ** $2');

  return (
    <div>
      <AuthHeader title="SMS tasdiqlash" subtitle={`${maskedPhone} raqamiga 6 xonali kod yuborildi`} />

      <div className="flex flex-col gap-5 rounded-xl border border-border-tertiary bg-surface p-5 shadow-card">
        {error && <Alert>{error}</Alert>}

        <OtpInput value={code} onChange={setCode} autoFocus disabled={loading} />

        <Button size="lg" fullWidth loading={loading} onClick={() => void verify()}>
          Tasdiqlash
        </Button>

        <div className="text-center text-sm text-content-secondary">
          {seconds > 0 ? (
            <span>
              Kodni qayta yuborish{' '}
              <span className="font-medium text-primary tabular-nums">
                00:{String(seconds).padStart(2, '0')}
              </span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void resend()}
              className="font-medium text-primary hover:underline"
            >
              Kodni qayta yuborish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Splash() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <div className="animate-pulse">
        <Logo size={44} />
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<Splash />}>
      <VerifyInner />
    </Suspense>
  );
}
