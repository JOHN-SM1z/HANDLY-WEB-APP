import { OrderStatus } from '@handly/contracts';

/**
 * M2+M3 transition table (customer + dispatch flow). Later milestones extend
 * targets further (ASSIGNED→EN_ROUTE etc.) — the guard stays the single authority.
 */
const TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.DRAFT]: [OrderStatus.PRICED, OrderStatus.CANCELLED_BY_CUSTOMER],
  [OrderStatus.PRICED]: [
    OrderStatus.PRICED, // re-diagnose / re-quote
    OrderStatus.DRAFT, // edited after quoting → must re-quote
    OrderStatus.SEARCHING,
    OrderStatus.CANCELLED_BY_CUSTOMER,
  ],
  // ASSIGNED = a dispatch offer was accepted; EXPIRED = the candidate pool
  // was exhausted (incl. one radius expansion) with no acceptance (M3).
  [OrderStatus.SEARCHING]: [
    OrderStatus.ASSIGNED,
    OrderStatus.EXPIRED,
    OrderStatus.CANCELLED_BY_CUSTOMER,
  ],
  [OrderStatus.ASSIGNED]: [OrderStatus.CANCELLED_BY_CUSTOMER],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Statuses in which the customer may still edit the request. */
export const EDITABLE_STATUSES: OrderStatus[] = [OrderStatus.DRAFT, OrderStatus.PRICED];
