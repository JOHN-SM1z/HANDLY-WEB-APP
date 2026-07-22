import { z } from 'zod';

// ─────────────── Enums (mirror prisma) ───────────────
export const PaymentStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  /** Beta Blocker Sprint — manual admin resolution, not a real provider reversal. */
  REFUNDED: 'REFUNDED',
} as const;
export const paymentStatusSchema = z.enum([
  PaymentStatus.PENDING,
  PaymentStatus.PROCESSING,
  PaymentStatus.SUCCEEDED,
  PaymentStatus.FAILED,
  PaymentStatus.CANCELLED,
  PaymentStatus.REFUNDED,
]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

/** Only MOCK is wired to a real provider today — see infra/payment. */
export const PaymentMethod = {
  CLICK: 'CLICK',
  PAYME: 'PAYME',
  UZUM: 'UZUM',
  MOCK: 'MOCK',
} as const;
export const paymentMethodSchema = z.enum([
  PaymentMethod.CLICK,
  PaymentMethod.PAYME,
  PaymentMethod.UZUM,
  PaymentMethod.MOCK,
]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const PAYMENT_METHOD_INFO: Record<PaymentMethod, { labelUz: string }> = {
  CLICK: { labelUz: 'Click' },
  PAYME: { labelUz: 'Payme' },
  UZUM: { labelUz: 'Uzum Bank' },
  MOCK: { labelUz: "Sinov to'lovi" },
};

// ─────────────── Request schemas ───────────────
export const paymentInitiateSchema = z.object({
  method: paymentMethodSchema,
});
export type PaymentInitiateInput = z.infer<typeof paymentInitiateSchema>;

/** Provider webhook payload — providerRef acts as an unguessable bearer, same trust model as GET /media/:id. */
export const paymentWebhookSchema = z.object({
  providerRef: z.string().min(1),
  success: z.boolean(),
  failureReason: z.string().max(500).optional(),
});
export type PaymentWebhookInput = z.infer<typeof paymentWebhookSchema>;

// ─────────────── Response shapes ───────────────
export interface PaymentDto {
  id: string;
  orderId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  platformFee: number;
  taxRate: number;
  taxAmount: number;
  masterNetAmount: number;
  failureReason: string | null;
  /** Beta Blocker Sprint — set once an admin closes the loop on this
   * payment (refunded or not); null until then. */
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  succeededAt: string | null;
  failedAt: string | null;
}

/** Admin manual-resolution action (Beta Blocker Sprint) — no real payment-
 * provider reversal call, just a documented foundation: mark the payment
 * refunded (only valid from SUCCEEDED) or record the issue as resolved
 * without changing status, always with a reason and always notifying the
 * customer. */
export const adminPaymentResolveSchema = z.object({
  refund: z.boolean(),
  note: z.string().trim().min(3).max(500),
});
export type AdminPaymentResolveInput = z.infer<typeof adminPaymentResolveSchema>;

export interface PaymentListPage {
  items: PaymentDto[];
  nextCursor: string | null;
}

export interface MasterEarningsSummaryDto {
  totalNetAmount: number;
  jobsPaid: number;
}

export interface MasterEarningsPage {
  summary: MasterEarningsSummaryDto;
  items: PaymentDto[];
  nextCursor: string | null;
}
