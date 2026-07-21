import { z } from 'zod';
import type { Complexity, OrderStatus, ServiceTier } from './order';

// ─────────────── Enums (mirror prisma) ───────────────
export const DispatchStatus = {
  OFFERED: 'OFFERED',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  EXPIRED: 'EXPIRED',
  WITHDRAWN: 'WITHDRAWN',
} as const;
export const dispatchStatusSchema = z.enum([
  DispatchStatus.OFFERED,
  DispatchStatus.ACCEPTED,
  DispatchStatus.DECLINED,
  DispatchStatus.EXPIRED,
  DispatchStatus.WITHDRAWN,
]);
export type DispatchStatus = z.infer<typeof dispatchStatusSchema>;

export const NotificationType = {
  OFFER_RECEIVED: 'OFFER_RECEIVED',
  OFFER_EXPIRED: 'OFFER_EXPIRED',
  ORDER_ASSIGNED: 'ORDER_ASSIGNED',
  ORDER_SEARCH_FAILED: 'ORDER_SEARCH_FAILED',
  ORDER_COMPLETED: 'ORDER_COMPLETED',
  ORDER_CLOSED: 'ORDER_CLOSED',
  PAYMENT_SUCCEEDED: 'PAYMENT_SUCCEEDED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  VERIFICATION_APPROVED: 'VERIFICATION_APPROVED',
  VERIFICATION_REJECTED: 'VERIFICATION_REJECTED',
  GUARANTEE_CLAIM_DECIDED: 'GUARANTEE_CLAIM_DECIDED',
  PENALTY_ISSUED: 'PENALTY_ISSUED',
  REFERRAL_REWARDED: 'REFERRAL_REWARDED',
  ORDER_CANCELLED_BY_MASTER: 'ORDER_CANCELLED_BY_MASTER',
} as const;
export const notificationTypeSchema = z.enum([
  NotificationType.OFFER_RECEIVED,
  NotificationType.OFFER_EXPIRED,
  NotificationType.ORDER_ASSIGNED,
  NotificationType.ORDER_SEARCH_FAILED,
  NotificationType.ORDER_COMPLETED,
  NotificationType.ORDER_CLOSED,
  NotificationType.PAYMENT_SUCCEEDED,
  NotificationType.PAYMENT_FAILED,
  NotificationType.VERIFICATION_APPROVED,
  NotificationType.VERIFICATION_REJECTED,
  NotificationType.GUARANTEE_CLAIM_DECIDED,
  NotificationType.PENALTY_ISSUED,
  NotificationType.REFERRAL_REWARDED,
  NotificationType.ORDER_CANCELLED_BY_MASTER,
]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

// ─────────────── Request schemas ───────────────
export const masterAvailabilityUpdateSchema = z.object({
  isOnline: z.boolean(),
});
export type MasterAvailabilityUpdate = z.infer<typeof masterAvailabilityUpdateSchema>;

// ─────────────── Response shapes ───────────────
/** A single pending offer, as seen by the master it was offered to. */
export interface OfferDto {
  dispatchId: string;
  orderId: string;
  orderNo: number;
  categoryName: string | null;
  description: string;
  serviceTier: ServiceTier;
  complexity: Complexity | null;
  addressText: string | null;
  distanceM: number;
  priceMin: number | null;
  priceMax: number | null;
  platformFee: number;
  offeredAt: string;
  expiresAt: string;
}

export interface MasterAvailabilityDto {
  isOnline: boolean;
  onlineSince: string | null;
}

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListPage {
  items: NotificationDto[];
  nextCursor: string | null;
}

/** Real-time payload pushed over the `order:updated` socket event. */
export interface OrderUpdatedEvent {
  orderId: string;
  status: OrderStatus;
}
