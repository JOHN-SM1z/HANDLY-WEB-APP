import { z } from 'zod';

export const PenaltyEventType = {
  CANCELLATION: 'CANCELLATION',
  NO_SHOW: 'NO_SHOW',
  LATE_RESPONSE: 'LATE_RESPONSE',
  POOR_QUALITY: 'POOR_QUALITY',
  CUSTOMER_COMPLAINT: 'CUSTOMER_COMPLAINT',
} as const;
export const penaltyEventTypeSchema = z.enum([
  PenaltyEventType.CANCELLATION,
  PenaltyEventType.NO_SHOW,
  PenaltyEventType.LATE_RESPONSE,
  PenaltyEventType.POOR_QUALITY,
  PenaltyEventType.CUSTOMER_COMPLAINT,
]);
export type PenaltyEventType = z.infer<typeof penaltyEventTypeSchema>;

export const PenaltySeverity = {
  MINOR: 'MINOR',
  MODERATE: 'MODERATE',
  SEVERE: 'SEVERE',
} as const;
export const penaltySeveritySchema = z.enum([
  PenaltySeverity.MINOR,
  PenaltySeverity.MODERATE,
  PenaltySeverity.SEVERE,
]);
export type PenaltySeverity = z.infer<typeof penaltySeveritySchema>;

export interface PenaltyRecordDto {
  id: string;
  eventType: PenaltyEventType;
  severity: PenaltySeverity;
  points: number;
  orderId: string | null;
  note: string | null;
  createdAt: string;
}

export interface PenaltyHistoryPage {
  items: PenaltyRecordDto[];
  /** Sum of points in the trailing window TrustService uses for its deduction. */
  activePoints: number;
}
