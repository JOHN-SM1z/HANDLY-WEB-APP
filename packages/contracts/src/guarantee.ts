import { z } from 'zod';

export const GuaranteeClaimStatus = {
  OPEN: 'OPEN',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export const guaranteeClaimStatusSchema = z.enum([
  GuaranteeClaimStatus.OPEN,
  GuaranteeClaimStatus.UNDER_REVIEW,
  GuaranteeClaimStatus.APPROVED,
  GuaranteeClaimStatus.REJECTED,
]);
export type GuaranteeClaimStatus = z.infer<typeof guaranteeClaimStatusSchema>;

export const guaranteeClaimCreateSchema = z.object({
  reason: z.string().trim().min(10, "Sababni kamida 10 ta belgi bilan yozing").max(1000),
});
export type GuaranteeClaimCreateInput = z.infer<typeof guaranteeClaimCreateSchema>;

/** Admin-ready decision — API only, no dashboard UI yet (Batch 3). */
export const guaranteeClaimDecisionSchema = z.object({
  approve: z.boolean(),
  resolutionNote: z.string().trim().max(1000).optional(),
});
export type GuaranteeClaimDecisionInput = z.infer<typeof guaranteeClaimDecisionSchema>;

export interface GuaranteeClaimDto {
  id: string;
  orderId: string;
  reason: string;
  status: GuaranteeClaimStatus;
  resolutionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
}
