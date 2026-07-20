import { OrderStatus } from '@handly/contracts';

/**
 * M2 transition table (customer flow). Later milestones extend targets
 * (SEARCHING→ASSIGNED etc.) — the guard stays the single authority.
 */
const TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.DRAFT]: [OrderStatus.PRICED, OrderStatus.CANCELLED_BY_CUSTOMER],
  [OrderStatus.PRICED]: [
    OrderStatus.PRICED, // re-diagnose / re-quote
    OrderStatus.DRAFT, // edited after quoting → must re-quote
    OrderStatus.SEARCHING,
    OrderStatus.CANCELLED_BY_CUSTOMER,
  ],
  [OrderStatus.SEARCHING]: [OrderStatus.CANCELLED_BY_CUSTOMER],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Statuses in which the customer may still edit the request. */
export const EDITABLE_STATUSES: OrderStatus[] = [OrderStatus.DRAFT, OrderStatus.PRICED];
