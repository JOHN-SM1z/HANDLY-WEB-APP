import type { Complexity } from '@handly/contracts';

/**
 * Trust-tier gate per ARCHITECTURE §9.1 (T0=Simple, T1=+Medium, T2=+Complex,
 * T3=+Critical). MasterProfile.trustTier is static for M3 (see CLAUDE.md) —
 * this only reads it, the recompute engine that writes it is a later milestone.
 */
export function requiredTierForComplexity(complexity: Complexity | null): number {
  switch (complexity) {
    case 'CRITICAL':
      return 3;
    case 'COMPLEX':
      return 2;
    case 'MEDIUM':
      return 1;
    case 'SIMPLE':
    default:
      return 0;
  }
}

export interface ScoringInput {
  distanceM: number;
  ratingAvg: number;
  jobsDone: number;
}

/**
 * Distance is normalized against a fixed reference, not each candidate's own
 * ServiceArea.radiusM — using a master's own (eligibility) radius here would
 * reward masters who declared a huge coverage area with an artificially high
 * "closeness" score. Eligibility (§9.2.1, is this order in range at all) and
 * ranking (§9.2.2, how good is this candidate among the eligible) are
 * deliberately different concerns using different radii.
 */
const SCORE_DISTANCE_REFERENCE_M = 20_000;

/**
 * Weighted(distance, rating, completed jobs) per §9.2.2 — response-rate and
 * AI-match-confidence factors are dropped for M3 (no data source exists yet
 * for either); Premium boost is dropped (no subscriptions yet). Distance
 * dominates, matching "select randomly the closest master."
 */
export function scoreCandidate({ distanceM, ratingAvg, jobsDone }: ScoringInput): number {
  const distanceScore = clamp01(1 - distanceM / SCORE_DISTANCE_REFERENCE_M);
  const ratingScore = clamp01(ratingAvg / 5);
  const jobsScore = clamp01(jobsDone / 100); // saturates at 100 jobs
  return 0.5 * distanceScore + 0.35 * ratingScore + 0.15 * jobsScore;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Weighted-random pick among the (already top-N-sliced) candidates — "select
 * randomly the closest master" per §9.2.3: quality-weighted, not a pure
 * ranked pick, so one master can't monopolize a zone.
 */
export function weightedRandomPick<T>(candidates: T[], weightOf: (c: T) => number): T {
  if (candidates.length === 0) throw new Error('weightedRandomPick: candidates is empty');
  const weights = candidates.map((c) => Math.max(weightOf(c), 0.0001)); // never fully zero out a candidate
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return candidates[i]!;
  }
  return candidates[candidates.length - 1]!;
}
