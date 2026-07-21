import { OrderStatus } from '@handly/contracts';

/**
 * M2+M3+M4+Batch2 transition table (customer + dispatch + job-execution +
 * master-cancellation flow) — the guard stays the single authority; every
 * state-changing service method calls canTransition before writing.
 *
 * Job execution (M4): ASSIGNED → EN_ROUTE → IN_PROGRESS → COMPLETED → CLOSED,
 * one state per master action (en-route, start, complete) plus a customer
 * confirmation (CLOSED).
 *
 * Master cancellation (Batch 2): a master can back out of ASSIGNED/EN_ROUTE
 * (not once IN_PROGRESS — work is happening) — this is the penalty engine's
 * "master cancellation" trigger, previously modeled in the enum but
 * deliberately unreachable until this batch actually needed it. DISPUTED
 * stays unreachable (no dispute-resolution flow yet) — the enum value exists
 * in schema for when that future work lands.
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
  // Customer can still back out before the master heads over or starts work;
  // once IN_PROGRESS, cancellation is no longer offered (work is happening).
  [OrderStatus.ASSIGNED]: [
    OrderStatus.EN_ROUTE,
    OrderStatus.CANCELLED_BY_CUSTOMER,
    OrderStatus.CANCELLED_BY_MASTER,
  ],
  [OrderStatus.EN_ROUTE]: [
    OrderStatus.IN_PROGRESS,
    OrderStatus.CANCELLED_BY_CUSTOMER,
    OrderStatus.CANCELLED_BY_MASTER,
  ],
  [OrderStatus.IN_PROGRESS]: [OrderStatus.COMPLETED],
  // Customer confirmation closes the order; a customer who never confirms
  // simply leaves it COMPLETED (no auto-close worker in this milestone).
  [OrderStatus.COMPLETED]: [OrderStatus.CLOSED],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Statuses in which the customer may still edit the request. */
export const EDITABLE_STATUSES: OrderStatus[] = [OrderStatus.DRAFT, OrderStatus.PRICED];

/**
 * Statuses in which a master is actively occupied by a job — used both for
 * "what's my current job" (master dashboard) and dispatch eligibility's
 * "exclude masters already busy" filter, so a master can't be offered a
 * second job while working this one.
 */
export const ACTIVE_MASTER_JOB_STATUSES: OrderStatus[] = [
  OrderStatus.ASSIGNED,
  OrderStatus.EN_ROUTE,
  OrderStatus.IN_PROGRESS,
  OrderStatus.COMPLETED,
];
