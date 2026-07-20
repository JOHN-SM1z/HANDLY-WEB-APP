'use client';

import { useState } from 'react';
import { COMPLEXITY_INFO, type OrderDto, SERVICE_TIER_INFO } from '@handly/contracts';
import type { CategoryDto } from '@/lib/categories';
import { ApiError } from '@/lib/api';
import { ordersApi } from '@/lib/orders';
import { formatSom, formatSomRange } from '@/lib/format';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckIcon, ClockIcon, SparkleIcon } from '@/components/ui/icons';

export function StepQuote({
  order,
  categories,
  onBack,
  onSubmitted,
}: {
  order: OrderDto | null;
  categories: CategoryDto[];
  onBack: () => void;
  onSubmitted: () => void;
}) {
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!order || !order.aiDiagnosis || order.priceMin == null || order.priceMax == null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="animate-pulse text-content-muted">
          <SparkleIcon width={28} height={28} />
        </div>
        <p className="text-sm text-content-secondary">AI tahlil qilmoqda…</p>
      </div>
    );
  }

  const category = categories.find((c) => c.id === order.categoryId);
  const suggested = order.aiDiagnosis.suggestedCategorySlug;
  const suggestedDiffers = suggested && category && suggested !== category.slug;
  const suggestedCategory = suggestedDiffers ? categories.find((c) => c.slug === suggested) : null;
  const tierInfo = SERVICE_TIER_INFO[order.serviceTier];

  async function handleSubmit() {
    setError(null);
    if (!order) return;
    setSubmitting(true);
    try {
      await ordersApi.submit(order.id);
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Yuborishda xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-5 py-5">
      {error && <Alert>{error}</Alert>}

      <div className="rounded-xl border border-border-tertiary bg-surface p-4 shadow-card">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-primary">
            <SparkleIcon width={15} height={15} />
          </span>
          <p className="text-sm font-semibold text-content-primary">AI tashxisi</p>
        </div>
        <p className="text-sm leading-relaxed text-content-secondary">
          {order.aiDiagnosis.issueSummary}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="blue">{category?.nameUz ?? "Xizmat"}</Badge>
          <Badge variant="gray">{COMPLEXITY_INFO[order.aiDiagnosis.complexity].labelUz}</Badge>
        </div>
        {suggestedDiffers && suggestedCategory && (
          <p className="mt-2 text-xs text-content-muted">
            AI taklifi: {suggestedCategory.nameUz} bo&apos;lishi ham mumkin
          </p>
        )}
      </div>

      <div className="rounded-xl bg-background-secondary p-4">
        <span className="text-xs text-content-muted">Xizmat narxi diapazoni</span>
        <p className="mt-1 text-xl font-semibold tabular-nums text-content-primary">
          {formatSomRange(order.priceMin, order.priceMax)}
        </p>
        {order.platformFee > 0 && (
          <p className="mt-1 text-xs text-content-secondary">
            + {formatSom(order.platformFee)} platforma haqi ({tierInfo.labelUz.toLowerCase()})
          </p>
        )}
        <p className="mt-2 flex items-center gap-1 text-xs text-content-secondary">
          <ClockIcon width={12} height={12} /> {tierInfo.etaUz}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setConsent((c) => !c)}
        className="flex items-start gap-2.5 rounded-md border border-border-secondary p-3 text-left"
      >
        <span
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
            consent ? 'border-primary bg-primary text-primary-fg' : 'border-border-primary'
          }`}
        >
          {consent && <CheckIcon width={10} height={10} />}
        </span>
        <span className="text-xs leading-relaxed text-content-secondary">
          Ommaviy oferta shartlari bilan tanishdim va roziman
        </span>
      </button>

      <div className="mt-auto flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Orqaga
        </Button>
        <Button
          disabled={!consent}
          loading={submitting}
          onClick={() => void handleSubmit()}
          className="flex-[2]"
        >
          Buyurtma yuborish
        </Button>
      </div>
    </div>
  );
}
