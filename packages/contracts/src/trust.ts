import type { VerificationStatus } from './user';

/**
 * Trust score (Batch 2) — deterministic, explainable, no AI involved. See
 * apps/api/src/modules/trust/trust.service.ts for the exact formula/weights.
 * Recomputed explicitly after specific events (job closed, review posted,
 * penalty issued) — never on a background schedule.
 */
export interface TrustFactorsDto {
  jobsDone: number;
  ratingAvg: number;
  /** Fraction of assigned jobs the master cancelled, 0..1. */
  cancellationRate: number;
  /** Fraction of dispatch offers accepted (vs. declined/expired), 0..1. */
  responseRate: number;
  verificationStatus: VerificationStatus;
  /** Sum of PenaltyRecord.points in the trailing window. */
  activePenaltyPoints: number;
}

export interface TrustScoreDto {
  /** 0..100 */
  score: number;
  /** 0..3, matches MasterProfile.trustTier / the dispatch trust-tier gate. */
  tier: number;
  factors: TrustFactorsDto;
}
