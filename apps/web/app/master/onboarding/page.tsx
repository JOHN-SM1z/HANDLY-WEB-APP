'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { masterProfileUpdateSchema } from '@handly/contracts';
import { AppHeader } from '@/components/app-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CameraIcon, CheckIcon, MapPinIcon } from '@/components/ui/icons';
import { Logo } from '@/components/ui/logo';
import { TextField } from '@/components/ui/text-field';
import { Textarea } from '@/components/ui/textarea';
import { categoriesApi } from '@/lib/categories';
import { ApiError } from '@/lib/api';
import { getCurrentPosition } from '@/lib/geo';
import { masterApi } from '@/lib/master';
import { verificationApi } from '@/lib/verification';
import { useRequireAuth } from '@/lib/use-require-auth';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

/**
 * Master onboarding (Beta Blocker Sprint) — the one screen that lets a
 * master declare the two fields dispatch actually requires (skills,
 * service area), plus the profile info a real marketplace needs before
 * trusting/matching someone. Reachable from /master's incomplete-profile
 * banner, and directly after signup via the verify-page redirect.
 *
 * A single scrollable form rather than a multi-step wizard — the customer
 * request wizard's 3-step shape exists because AI diagnosis + pricing need
 * to happen between steps; nothing here has that kind of sequential
 * dependency, so one page is simpler and matches "don't add complexity."
 */
export default function MasterOnboardingPage() {
  const { ready, user } = useRequireAuth('MASTER');
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ['master', 'profile'],
    queryFn: masterApi.getProfile,
    enabled: Boolean(user),
  });
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  });

  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [experienceYears, setExperienceYears] = useState('0');
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [areaLabel, setAreaLabel] = useState('');
  const [areaLat, setAreaLat] = useState<number | null>(null);
  const [areaLng, setAreaLng] = useState<number | null>(null);
  const [radiusM, setRadiusM] = useState('10000');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [certFiles, setCertFiles] = useState<File[]>([]);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'submitted'>('form');
  const hydrated = useRef(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const certInputRef = useRef<HTMLInputElement>(null);

  // Prefill from the master's existing profile once (e.g. resuming after a
  // rejection, or adding a missing service area to an otherwise-complete one).
  useEffect(() => {
    if (!profile || hydrated.current) return;
    hydrated.current = true;
    setFullName(profile.fullName ?? '');
    setBio(profile.bio ?? '');
    setExperienceYears(String(profile.experienceYears));
    setSkillIds(profile.skills.map((s) => s.categoryId));
    if (profile.avatarUrl) setAvatarPreview(profile.avatarUrl);
    const area = profile.serviceAreas[0];
    if (area) {
      setAreaLabel(area.label);
      setAreaLat(area.centerLat);
      setAreaLng(area.centerLng);
      setRadiusM(String(area.radiusM));
    }
  }, [profile]);

  const submitOnboarding = useMutation({
    mutationFn: async () => {
      if (areaLat == null || areaLng == null) {
        throw new ApiError(400, "Xizmat hududini belgilang (joylashuvni aniqlang)");
      }

      const payload = {
        fullName: fullName.trim(),
        experienceYears: Number(experienceYears) || 0,
        bio: bio.trim() || undefined,
        // isSelfEmployed/pinfl are tax-registration details out of scope for
        // this onboarding flow — left at their schema defaults; a master can
        // set them later via the same PATCH /me/master endpoint if a future
        // screen collects them.
        isSelfEmployed: profile?.isSelfEmployed ?? false,
        skills: skillIds,
        serviceAreas: [
          {
            label: areaLabel.trim() || "Ish hududim",
            centerLat: areaLat,
            centerLng: areaLng,
            radiusM: Number(radiusM),
          },
        ],
      };
      // Same bounds the server enforces (masterProfileUpdateSchema) — catch
      // an out-of-range value (e.g. radius/experience typed past the HTML
      // input's min/max hint) before uploading any files, not just after a
      // round-trip to the API.
      const parsed = masterProfileUpdateSchema.omit({ avatarUrl: true, pinfl: true }).safeParse(payload);
      if (!parsed.success) {
        throw new ApiError(400, parsed.error.issues[0]?.message ?? "Ma'lumotlar noto'g'ri kiritildi");
      }

      let avatarUrl = profile?.avatarUrl ?? undefined;
      if (avatarFile) {
        const uploaded = await masterApi.uploadMedia('PORTFOLIO', avatarFile);
        avatarUrl = `${BASE_URL}/media/master/${uploaded.id}`;
      }
      for (const file of certFiles) {
        await masterApi.uploadMedia('CERTIFICATION', file);
      }
      await masterApi.updateProfile({ ...parsed.data, avatarUrl });
      if (!profile?.verificationStatus || profile.verificationStatus === 'UNVERIFIED' || profile.verificationStatus === 'REJECTED') {
        await verificationApi.submit();
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['master', 'profile'] });
      void queryClient.invalidateQueries({ queryKey: ['master', 'verification'] });
      setStep('submitted');
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Saqlashda xatolik yuz berdi'),
  });

  function handleLocate() {
    setLocating(true);
    setError(null);
    getCurrentPosition()
      .then((pos) => {
        setAreaLat(pos.latitude);
        setAreaLng(pos.longitude);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLocating(false));
  }

  function toggleSkill(id: string) {
    setSkillIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  if (!ready || !user || profileLoading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <div className="animate-pulse">
          <Logo size={44} />
        </div>
      </main>
    );
  }

  if (profileError) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 px-5 text-center">
        <Alert>Profilni yuklab bo&apos;lmadi</Alert>
        <Button variant="outline" onClick={() => void refetchProfile()}>
          Qayta urinish
        </Button>
      </main>
    );
  }

  if (step === 'submitted') {
    return (
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
        <AppHeader backHref="/master" title="Tasdiqlash" />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary-soft-fg">
            <CheckIcon width={28} height={28} />
          </span>
          <h1 className="text-lg font-bold">Profil to&apos;ldirildi</h1>
          <p className="max-w-[32ch] text-sm text-content-secondary">
            Tasdiqlash so&apos;rovingiz yuborildi. Ko&apos;rib chiqilguncha kuting — natija haqida
            bildirishnoma orqali xabar beramiz.
          </p>
          <Button onClick={() => router.replace('/master')}>Boshqaruv paneliga qaytish</Button>
        </div>
      </main>
    );
  }

  const isValid = fullName.trim().length >= 2 && skillIds.length > 0 && areaLat != null && areaLng != null;

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-background">
      <AppHeader backHref="/master" title="Profilni to'ldirish" />

      <div className="flex flex-1 flex-col gap-5 px-5 py-5">
        {error && <Alert>{error}</Alert>}

        {/* Photo */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            aria-label="Profil rasmini yuklash"
            className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-secondary bg-background-secondary text-content-muted"
          >
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <CameraIcon width={22} height={22} />
            )}
          </button>
          <div>
            <p className="text-sm font-medium text-content-primary">Profil rasmi</p>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="text-xs font-medium text-primary"
            >
              {avatarPreview ? "O'zgartirish" : 'Rasm tanlash'}
            </button>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setAvatarFile(file);
              setAvatarPreview(URL.createObjectURL(file));
            }}
          />
        </div>

        <TextField
          label="F.I.Sh."
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Ismingiz va familiyangiz"
        />

        <TextField
          label="Tajriba (necha yil)"
          type="number"
          inputMode="numeric"
          min={0}
          max={70}
          value={experienceYears}
          onChange={(e) => setExperienceYears(e.target.value)}
        />

        <Textarea
          label="O'zingiz haqingizda (ixtiyoriy)"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Qisqacha tajribangiz, ishlash uslubingiz..."
          maxLength={1000}
        />

        {/* Skills / categories — required for dispatch matching */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-content-primary">Xizmat turlari</span>
          <p className="text-xs text-content-muted">
            Kamida bittasini tanlang — shunga mos buyurtmalarni olasiz.
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {categories?.map((c) => {
              const active = skillIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleSkill(c.id)}
                  className={
                    active
                      ? 'rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-fg'
                      : 'rounded-full border border-border-secondary bg-surface px-3.5 py-1.5 text-xs font-medium text-content-secondary'
                  }
                >
                  {c.nameUz}
                </button>
              );
            })}
          </div>
        </div>

        {/* Service area — required for dispatch matching */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-content-primary">Ish hududi</span>
          <p className="text-xs text-content-muted">
            Joriy joylashuvingiz markaz sifatida olinadi — undan qancha radiusda ishlashni tanlang.
          </p>
          <TextField
            className="mt-1"
            label="Hudud nomi"
            value={areaLabel}
            onChange={(e) => setAreaLabel(e.target.value)}
            placeholder="Masalan: Yunusobod va atrofi"
          />
          <Button
            type="button"
            variant="outline"
            loading={locating}
            onClick={handleLocate}
            className="mt-1 gap-2"
          >
            <MapPinIcon width={18} height={18} />
            {areaLat != null ? 'Joylashuvni yangilash' : 'Joriy joylashuvni aniqlash'}
          </Button>
          {areaLat != null && areaLng != null && (
            <p className="text-xs text-success-fg">
              Joylashuv aniqlandi ({areaLat.toFixed(4)}, {areaLng.toFixed(4)})
            </p>
          )}
          <TextField
            label="Radius (metr)"
            type="number"
            inputMode="numeric"
            min={500}
            max={50000}
            step={500}
            value={radiusM}
            onChange={(e) => setRadiusM(e.target.value)}
            hint="500 m dan 50 km gacha"
          />
        </div>

        {/* Certifications — optional real evidence, or the manual fallback below */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-content-primary">
            Sertifikat / hujjat (ixtiyoriy)
          </span>
          <p className="text-xs text-content-muted">
            Diplom, sertifikat yoki shaxsni tasdiqlovchi hujjat rasmi — tasdiqlashni tezlashtiradi.
            Yuklamasangiz ham so&apos;rovni yuborishingiz mumkin; jamoamiz qo&apos;shimcha
            ma&apos;lumot uchun siz bilan bog&apos;lanishi mumkin.
          </p>
          <Button type="button" variant="outline" onClick={() => certInputRef.current?.click()} className="mt-1">
            Fayl tanlash
          </Button>
          <input
            ref={certInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setCertFiles((prev) => [...prev, file]);
            }}
          />
          {certFiles.length > 0 && (
            <ul className="mt-1 flex flex-col gap-1">
              {certFiles.map((f, i) => (
                <li key={i} className="flex items-center justify-between text-xs text-content-secondary">
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setCertFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-danger-fg"
                  >
                    O&apos;chirish
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Button
          size="lg"
          fullWidth
          disabled={!isValid}
          loading={submitOnboarding.isPending}
          onClick={() => {
            setError(null);
            submitOnboarding.mutate();
          }}
          className="mt-2"
        >
          Saqlash va tasdiqlashga yuborish
        </Button>
      </div>
    </main>
  );
}
