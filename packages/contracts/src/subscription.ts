import { z } from 'zod';

export const SubscriptionPlan = {
  FREE: 'FREE',
  PREMIUM: 'PREMIUM',
} as const;
export const subscriptionPlanSchema = z.enum([SubscriptionPlan.FREE, SubscriptionPlan.PREMIUM]);
export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>;

export const SubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  TRIAL: 'TRIAL',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;
export const subscriptionStatusSchema = z.enum([
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIAL,
  SubscriptionStatus.EXPIRED,
  SubscriptionStatus.CANCELLED,
]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export interface MasterSubscriptionDto {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  /** Convenience flag the frontend/dispatch scoring can check directly. */
  isPremiumActive: boolean;
}
