import { z } from 'zod';

export const ReferralStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  REWARDED: 'REWARDED',
} as const;
export const referralStatusSchema = z.enum([
  ReferralStatus.PENDING,
  ReferralStatus.ACTIVE,
  ReferralStatus.REWARDED,
]);
export type ReferralStatus = z.infer<typeof referralStatusSchema>;

export const CashbackSourceType = {
  REFERRAL_REWARD: 'REFERRAL_REWARD',
  PROMOTION: 'PROMOTION',
} as const;
export const cashbackSourceTypeSchema = z.enum([
  CashbackSourceType.REFERRAL_REWARD,
  CashbackSourceType.PROMOTION,
]);
export type CashbackSourceType = z.infer<typeof cashbackSourceTypeSchema>;

export const CashbackStatus = {
  ELIGIBLE: 'ELIGIBLE',
  REDEEMED: 'REDEEMED',
} as const;
export const cashbackStatusSchema = z.enum([CashbackStatus.ELIGIBLE, CashbackStatus.REDEEMED]);
export type CashbackStatus = z.infer<typeof cashbackStatusSchema>;

export interface ReferralDto {
  id: string;
  refereeId: string;
  refereePhoneMasked: string;
  status: ReferralStatus;
  rewardedAt: string | null;
  createdAt: string;
}

export interface CashbackRecordDto {
  id: string;
  amount: number;
  sourceType: CashbackSourceType;
  status: CashbackStatus;
  note: string | null;
  createdAt: string;
}

export interface ReferralSummaryDto {
  referralCode: string;
  totalReferred: number;
  totalRewarded: number;
  totalCashbackEarned: number;
  referrals: ReferralDto[];
  cashbackRecords: CashbackRecordDto[];
}
