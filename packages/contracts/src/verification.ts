import { z } from 'zod';
import type { VerificationStatus } from './user';

export const verificationRequestSubmitSchema = z.object({
  note: z.string().trim().max(500).optional(),
});
export type VerificationRequestSubmitInput = z.infer<typeof verificationRequestSubmitSchema>;

/** Admin-ready decision — not exposed via a dashboard yet, ADMIN-role API only (Batch 3 builds the UI). */
export const verificationDecisionSchema = z.object({
  approve: z.boolean(),
  note: z.string().trim().max(500).optional(),
});
export type VerificationDecisionInput = z.infer<typeof verificationDecisionSchema>;

export interface VerificationRecordDto {
  id: string;
  status: VerificationStatus;
  provider: 'MYID' | 'MANUAL';
  note: string | null;
  decidedAt: string | null;
  createdAt: string;
}
