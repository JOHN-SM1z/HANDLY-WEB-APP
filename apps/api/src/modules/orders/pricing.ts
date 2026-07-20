import {
  COMPLEXITY_INFO,
  type Complexity,
  SERVICE_TIER_INFO,
  type ServiceTier,
} from '@handly/contracts';

export interface Quote {
  priceMin: number;
  priceMax: number;
  platformFee: number;
}

const ROUND_TO = 5_000;
const FLOOR = 30_000;

/**
 * Deterministic price range: category base band × complexity × service tier,
 * rounded to 5 000 so'm (min down, max up), floored at 30 000. The AI never
 * sets prices directly — it only classifies complexity (ARCHITECTURE §8).
 */
export function computeQuote(
  base: { min: number; max: number },
  complexity: Complexity,
  tier: ServiceTier,
): Quote {
  const c = COMPLEXITY_INFO[complexity].multiplier;
  const t = SERVICE_TIER_INFO[tier].multiplier;

  const rawMin = base.min * c * t;
  const rawMax = base.max * c * t;

  const priceMin = Math.max(FLOOR, Math.floor(rawMin / ROUND_TO) * ROUND_TO);
  const priceMax = Math.max(priceMin + ROUND_TO, Math.ceil(rawMax / ROUND_TO) * ROUND_TO);

  return { priceMin, priceMax, platformFee: SERVICE_TIER_INFO[tier].platformFee };
}
