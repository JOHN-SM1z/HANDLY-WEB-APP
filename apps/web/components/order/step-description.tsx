'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { OrderDto } from '@handly/contracts';
import type { CategoryDto } from '@/lib/categories';
import { ApiError } from '@/lib/api';
import { ordersApi } from '@/lib/orders';
import { getCurrentPosition } from '@/lib/geo';
import { cn } from '@/lib/cn';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Textarea } from '@/components/ui/textarea';
import { CategoryIcon } from '@/components/category-icon';
import { ArrowRightIcon, CameraIcon, MapPinIcon, VideoIcon, XIcon } from '@/components/ui/icons';

const MAX_MEDIA = 5;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

interface StagedFile {
  file: File;
  kind: 'PHOTO' | 'VIDEO';
  previewUrl: string | null;
}

export function StepDescription({
  categories,
  initialCategorySlug,
  order,
  onNext,
}: {
  categories: CategoryDto[];
  initialCategorySlug?: string;
  order: OrderDto | null;
  onNext: (orderId: string) => void;
}) {
  const [categoryId, setCategoryId] = useState<string | null>(
    order?.categoryId ?? categories.find((c) => c.slug === initialCategorySlug)?.id ?? null,
  );
  const [description, setDescription] = useState(order?.description ?? '');
  const [addressText, setAddressText] = useState(order?.addressText ?? '');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    order?.latitude != null && order?.longitude != null
      ? { lat: order.latitude, lng: order.longitude }
      : null,
  );
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [removedExistingIds, setRemovedExistingIds] = useState<string[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Sync local form state if we land here with a freshly-loaded resumed order.
  useEffect(() => {
    if (!order) return;
    setCategoryId((c) => c ?? order.categoryId);
    setDescription((d) => (d ? d : order.description));
    setAddressText((a) => (a ? a : (order.addressText ?? '')));
    setCoords((c) =>
      c || order.latitude == null || order.longitude == null
        ? c
        : { lat: order.latitude, lng: order.longitude },
    );
  }, [order]);

  useEffect(
    () => () => {
      staged.forEach((s) => s.previewUrl && URL.revokeObjectURL(s.previewUrl));
    },
    [staged],
  );

  const existingMedia = useMemo(
    () => (order?.media ?? []).filter((m) => !removedExistingIds.includes(m.id)),
    [order, removedExistingIds],
  );
  const totalMediaCount = existingMedia.length + staged.length;

  function pickFile(kind: 'PHOTO' | 'VIDEO', files: FileList | null) {
    setMediaError(null);
    const file = files?.[0];
    if (!file) return;
    if (totalMediaCount >= MAX_MEDIA) {
      setMediaError(`Ko'pi bilan ${MAX_MEDIA} ta fayl yuklash mumkin`);
      return;
    }
    const maxBytes = kind === 'PHOTO' ? MAX_PHOTO_BYTES : MAX_VIDEO_BYTES;
    if (file.size > maxBytes) {
      setMediaError(`Fayl juda katta (maksimum ${kind === 'PHOTO' ? 10 : 50} MB)`);
      return;
    }
    setStaged((prev) => [
      ...prev,
      { file, kind, previewUrl: kind === 'PHOTO' ? URL.createObjectURL(file) : null },
    ]);
  }

  function removeStaged(index: number) {
    setStaged((prev) => {
      const target = prev[index];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function removeExisting(mediaId: string) {
    if (!order) return;
    setRemovedExistingIds((prev) => [...prev, mediaId]);
    try {
      await ordersApi.deleteMedia(order.id, mediaId);
    } catch {
      setRemovedExistingIds((prev) => prev.filter((id) => id !== mediaId));
      setMediaError("Faylni o'chirishda xatolik");
    }
  }

  async function handleUseGps() {
    setGeoLoading(true);
    setGeoError(null);
    try {
      const pos = await getCurrentPosition();
      setCoords({ lat: pos.latitude, lng: pos.longitude });
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : "Joylashuvni aniqlab bo'lmadi");
    } finally {
      setGeoLoading(false);
    }
  }

  async function handleNext() {
    setFormError(null);
    if (!categoryId) {
      setFormError('Xizmat turini tanlang');
      return;
    }
    if (description.trim().length < 5) {
      setFormError("Muammoni kamida 5 ta belgi bilan tasvirlab bering");
      return;
    }
    if (!addressText.trim() && !coords) {
      setFormError("Manzilni kiriting yoki joylashuvni aniqlang");
      return;
    }

    setSaving(true);
    try {
      let id = order?.id;
      if (!id) {
        const created = await ordersApi.create({ categoryId, description: description.trim() });
        id = created.id;
      } else {
        await ordersApi.update(id, { categoryId, description: description.trim() });
      }
      await ordersApi.update(id, {
        addressText: addressText.trim() || undefined,
        ...(coords ? { latitude: coords.lat, longitude: coords.lng } : {}),
      });
      for (const s of staged) {
        await ordersApi.uploadMedia(id, s.file);
      }
      onNext(id);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Saqlashda xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-5 px-5 py-5">
      {formError && <Alert>{formError}</Alert>}

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">
          Xizmat turi
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={cn(
                'flex shrink-0 flex-col items-center gap-1.5 rounded-xl border px-3 py-2.5 transition-colors',
                categoryId === c.id
                  ? 'border-primary bg-primary-soft'
                  : 'border-border-secondary bg-surface',
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg',
                  categoryId === c.id ? 'bg-primary text-primary-fg' : 'bg-background-secondary text-primary',
                )}
              >
                <CategoryIcon iconKey={c.iconKey} />
              </span>
              <span
                className={cn(
                  'whitespace-nowrap text-[11px] font-medium',
                  categoryId === c.id ? 'text-primary-soft-fg' : 'text-content-secondary',
                )}
              >
                {c.nameUz}
              </span>
            </button>
          ))}
        </div>
      </div>

      <Textarea
        label="Muammo tavsifi"
        placeholder="Masalan: kran oqmoqda, oshxonada suv tomchilamoqda…"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={2000}
      />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-content-muted">
            Rasm / Video qo&apos;shish
          </p>
          <span className="text-xs text-content-muted">{totalMediaCount}/{MAX_MEDIA}</span>
        </div>
        {mediaError && (
          <p className="mb-2 text-xs text-danger-fg">{mediaError}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {existingMedia.map((m) => (
            <div key={m.id} className="relative h-16 w-16 overflow-hidden rounded-lg border border-border-secondary bg-background-secondary">
              {m.kind === 'PHOTO' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-content-muted">
                  <VideoIcon width={18} height={18} />
                  <span className="text-[9px]">Video</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => void removeExisting(m.id)}
                aria-label="Faylni o'chirish"
                className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink/70 text-ink-fg"
              >
                <XIcon width={11} height={11} />
              </button>
            </div>
          ))}
          {staged.map((s, i) => (
            <div key={`${s.file.name}-${i}`} className="relative h-16 w-16 overflow-hidden rounded-lg border border-border-secondary bg-background-secondary">
              {s.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.previewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-content-muted">
                  <VideoIcon width={18} height={18} />
                  <span className="text-[9px]">Video</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeStaged(i)}
                aria-label="Faylni olib tashlash"
                className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink/70 text-ink-fg"
              >
                <XIcon width={11} height={11} />
              </button>
            </div>
          ))}
          {totalMediaCount < MAX_MEDIA && (
            <>
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                aria-label="Rasm qo'shish"
                className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border-secondary text-content-muted hover:bg-background-secondary"
              >
                <CameraIcon width={20} height={20} />
              </button>
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                aria-label="Video qo'shish"
                className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border-secondary text-content-muted hover:bg-background-secondary"
              >
                <VideoIcon width={20} height={20} />
              </button>
            </>
          )}
        </div>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            pickFile('PHOTO', e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          className="hidden"
          onChange={(e) => {
            pickFile('VIDEO', e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">
          Manzil
        </p>
        {geoError && (
          <p className="mb-2 text-xs text-danger-fg">{geoError}</p>
        )}
        <button
          type="button"
          onClick={() => void handleUseGps()}
          disabled={geoLoading}
          className={cn(
            'mb-2 flex w-full items-center gap-2 rounded-md border px-3 py-2.5 text-sm transition-colors',
            coords
              ? 'border-primary bg-primary-soft text-primary-soft-fg'
              : 'border-border-secondary text-content-secondary hover:bg-background-secondary',
          )}
        >
          <MapPinIcon width={16} height={16} />
          {geoLoading
            ? 'Aniqlanmoqda…'
            : coords
              ? `Joylashuv aniqlandi (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`
              : 'GPS orqali joylashuvni aniqlash'}
        </button>
        <TextField
          placeholder="Manzilni kiriting (masalan: Toshkent, Chilonzor 14-kvartal)"
          value={addressText}
          onChange={(e) => setAddressText(e.target.value)}
        />
      </div>

      <Button size="lg" fullWidth loading={saving} onClick={() => void handleNext()} className="mt-auto">
        Keyingisi <ArrowRightIcon width={16} height={16} />
      </Button>
    </div>
  );
}
