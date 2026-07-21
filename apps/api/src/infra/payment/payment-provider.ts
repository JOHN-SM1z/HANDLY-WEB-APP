import type { PaymentMethod } from '@handly/contracts';

/**
 * Payment-rail abstraction (M5). Unlike AiProvider/PushProvider's "assists,
 * never gates" fallback, a charge result is money-critical and must be
 * reported truthfully — PaymentsService never silently treats a failure as
 * success. Only MockPaymentProvider exists today (no real Click/Payme/Uzum
 * merchant credentials); real rails implement the same interface and slot in
 * via PAYMENT_PROVIDER without touching PaymentsService.
 */
export interface ChargeInput {
  paymentId: string;
  amount: number;
  method: PaymentMethod;
}

export interface ChargeResult {
  success: boolean;
  /** Provider's own transaction id — stored unique so a replayed webhook can't double-settle. */
  providerRef: string;
  failureReason?: string;
}

export interface PaymentProvider {
  charge(input: ChargeInput): Promise<ChargeResult>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
