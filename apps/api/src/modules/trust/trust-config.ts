/**
 * Trust score formula constants (Batch 2) — the single source for the
 * weights/thresholds so the calculation stays deterministic and explainable
 * (per the batch's explicit "no unnecessary AI dependency" / "deterministic"
 * requirement). Weights sum to 100 before the penalty deduction.
 */
export const TRUST_WEIGHTS = {
  jobsDone: 30,
  rating: 25,
  responseRate: 15,
  cancellationRate: 15,
  verification: 15,
} as const;

/** jobsDone contributes its full weight once a master hits this many completed jobs. */
export const JOBS_DONE_CAP = 50;

/** How far back PenaltyRecord points count against the score. */
export const PENALTY_LOOKBACK_DAYS = 90;

/** However many points a master has racked up, the score can only drop this much. */
export const MAX_PENALTY_DEDUCTION = 20;

/** score >= threshold[i] -> tier i+1; below all thresholds -> tier 0. */
export const TRUST_TIER_THRESHOLDS = [40, 60, 80] as const;

export function scoreToTier(score: number): number {
  let tier = 0;
  for (const threshold of TRUST_TIER_THRESHOLDS) {
    if (score >= threshold) tier += 1;
  }
  return tier;
}
