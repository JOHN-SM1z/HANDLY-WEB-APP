import type { SubscriptionPlan } from './subscription';

/** Real-data-only master analytics (Batch 2) — no fake/demo values. */
export interface MasterAnalyticsDto {
  jobsDone: number;
  ratingAvg: number;
  /** Average of the last 10 reviews minus the all-time ratingAvg — positive = trending up. */
  ratingTrendDelta: number;
  /** Fraction of dispatch offers accepted (vs. declined/expired), 0..1. */
  responseRate: number;
  trustScore: number;
  trustTier: number;
  subscriptionPlan: SubscriptionPlan;
  earnings: {
    totalNetAmount: number;
    jobsPaid: number;
  };
}
