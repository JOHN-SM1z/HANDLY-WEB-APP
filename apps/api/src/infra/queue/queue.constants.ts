/** One queue for M3 — dispatch cascade + offer expiry. More queues can join this pattern later. */
export const DISPATCH_QUEUE_NAME = 'dispatch';

export const DispatchJobName = {
  CASCADE_NEXT: 'cascade-next',
  OFFER_EXPIRY: 'offer-expiry',
} as const;
export type DispatchJobName = (typeof DispatchJobName)[keyof typeof DispatchJobName];

export interface CascadeNextJobData {
  orderId: string;
}

export interface OfferExpiryJobData {
  dispatchId: string;
}

/**
 * Deterministic jobIds — BullMQ de-dupes same-id enqueues, giving idempotency
 * for free. BullMQ forbids `:` in custom job IDs (it's the key delimiter it
 * uses internally), so these use `-` throughout.
 */
export const offerExpiryJobId = (dispatchId: string): string => `offer-expiry-${dispatchId}`;
export const cascadeNextJobId = (orderId: string, attempt: number): string =>
  `cascade-next-${orderId}-${attempt}`;
