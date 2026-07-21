import { PenaltyEventType, PenaltySeverity } from '@handly/contracts';

/**
 * Single source of penalty severity/points per event type — every call site
 * looks this up rather than hardcoding a number, so tuning a penalty is a
 * one-line change here, not a hunt through the codebase.
 */
export const PENALTY_RULES: Record<PenaltyEventType, { severity: PenaltySeverity; points: number }> = {
  [PenaltyEventType.CANCELLATION]: { severity: PenaltySeverity.MODERATE, points: 10 },
  [PenaltyEventType.NO_SHOW]: { severity: PenaltySeverity.SEVERE, points: 20 },
  [PenaltyEventType.LATE_RESPONSE]: { severity: PenaltySeverity.MINOR, points: 3 },
  [PenaltyEventType.POOR_QUALITY]: { severity: PenaltySeverity.MODERATE, points: 8 },
  [PenaltyEventType.CUSTOMER_COMPLAINT]: { severity: PenaltySeverity.MINOR, points: 5 },
};
