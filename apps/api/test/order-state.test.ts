import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OrderStatus } from '@handly/contracts';
import { ACTIVE_MASTER_JOB_STATUSES, canTransition, EDITABLE_STATUSES } from '../src/modules/orders/order-state';

test('DRAFT -> PRICED -> SEARCHING is the happy path', () => {
  assert.equal(canTransition(OrderStatus.DRAFT, OrderStatus.PRICED), true);
  assert.equal(canTransition(OrderStatus.PRICED, OrderStatus.SEARCHING), true);
});

test('editing after PRICED drops back to DRAFT', () => {
  assert.equal(canTransition(OrderStatus.PRICED, OrderStatus.DRAFT), true);
});

test('SEARCHING cannot be re-priced or re-drafted', () => {
  assert.equal(canTransition(OrderStatus.SEARCHING, OrderStatus.PRICED), false);
  assert.equal(canTransition(OrderStatus.SEARCHING, OrderStatus.DRAFT), false);
});

test('cancellation allowed from DRAFT, PRICED, and SEARCHING', () => {
  for (const from of [OrderStatus.DRAFT, OrderStatus.PRICED, OrderStatus.SEARCHING]) {
    assert.equal(canTransition(from, OrderStatus.CANCELLED_BY_CUSTOMER), true, from);
  }
});

test('cannot skip DRAFT straight to SEARCHING (must be priced first)', () => {
  assert.equal(canTransition(OrderStatus.DRAFT, OrderStatus.SEARCHING), false);
});

test('a completed order cannot transition anywhere via this table', () => {
  assert.equal(canTransition(OrderStatus.COMPLETED, OrderStatus.CANCELLED_BY_CUSTOMER), false);
});

test('DRAFT and PRICED are editable; SEARCHING is not', () => {
  assert.ok(EDITABLE_STATUSES.includes(OrderStatus.DRAFT));
  assert.ok(EDITABLE_STATUSES.includes(OrderStatus.PRICED));
  assert.ok(!EDITABLE_STATUSES.includes(OrderStatus.SEARCHING));
});

// ─────────────── M3: dispatch/matching extensions ───────────────

test('SEARCHING -> ASSIGNED on a successful dispatch accept', () => {
  assert.equal(canTransition(OrderStatus.SEARCHING, OrderStatus.ASSIGNED), true);
});

test('SEARCHING -> EXPIRED when the candidate pool is exhausted', () => {
  assert.equal(canTransition(OrderStatus.SEARCHING, OrderStatus.EXPIRED), true);
});

test('cancellation allowed from ASSIGNED too (customer changes their mind post-match)', () => {
  assert.equal(canTransition(OrderStatus.ASSIGNED, OrderStatus.CANCELLED_BY_CUSTOMER), true);
});

test('ASSIGNED cannot be re-assigned, re-searched, or re-priced', () => {
  assert.equal(canTransition(OrderStatus.ASSIGNED, OrderStatus.ASSIGNED), false);
  assert.equal(canTransition(OrderStatus.ASSIGNED, OrderStatus.SEARCHING), false);
  assert.equal(canTransition(OrderStatus.ASSIGNED, OrderStatus.PRICED), false);
});

test('EXPIRED is terminal via this table (no further transitions modeled yet)', () => {
  assert.equal(canTransition(OrderStatus.EXPIRED, OrderStatus.SEARCHING), false);
  assert.equal(canTransition(OrderStatus.EXPIRED, OrderStatus.CANCELLED_BY_CUSTOMER), false);
});

test('ASSIGNED is not editable (only DRAFT/PRICED are)', () => {
  assert.ok(!EDITABLE_STATUSES.includes(OrderStatus.ASSIGNED));
});

// ─────────────── M4: job-execution extensions ───────────────

test('the full job-execution happy path: ASSIGNED -> EN_ROUTE -> IN_PROGRESS -> COMPLETED -> CLOSED', () => {
  assert.equal(canTransition(OrderStatus.ASSIGNED, OrderStatus.EN_ROUTE), true);
  assert.equal(canTransition(OrderStatus.EN_ROUTE, OrderStatus.IN_PROGRESS), true);
  assert.equal(canTransition(OrderStatus.IN_PROGRESS, OrderStatus.COMPLETED), true);
  assert.equal(canTransition(OrderStatus.COMPLETED, OrderStatus.CLOSED), true);
});

test('cancellation is still allowed from EN_ROUTE but not once IN_PROGRESS', () => {
  assert.equal(canTransition(OrderStatus.EN_ROUTE, OrderStatus.CANCELLED_BY_CUSTOMER), true);
  assert.equal(canTransition(OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED_BY_CUSTOMER), false);
});

test('no state can be skipped in the execution flow', () => {
  assert.equal(canTransition(OrderStatus.ASSIGNED, OrderStatus.IN_PROGRESS), false);
  assert.equal(canTransition(OrderStatus.ASSIGNED, OrderStatus.COMPLETED), false);
  assert.equal(canTransition(OrderStatus.EN_ROUTE, OrderStatus.COMPLETED), false);
  assert.equal(canTransition(OrderStatus.EN_ROUTE, OrderStatus.CLOSED), false);
  assert.equal(canTransition(OrderStatus.IN_PROGRESS, OrderStatus.CLOSED), false);
});

test('no step in the execution flow can be repeated or reversed', () => {
  assert.equal(canTransition(OrderStatus.EN_ROUTE, OrderStatus.ASSIGNED), false);
  assert.equal(canTransition(OrderStatus.IN_PROGRESS, OrderStatus.EN_ROUTE), false);
  assert.equal(canTransition(OrderStatus.COMPLETED, OrderStatus.IN_PROGRESS), false);
  assert.equal(canTransition(OrderStatus.IN_PROGRESS, OrderStatus.IN_PROGRESS), false);
});

test('CLOSED is terminal — no further transitions modeled', () => {
  assert.equal(canTransition(OrderStatus.CLOSED, OrderStatus.COMPLETED), false);
  assert.equal(canTransition(OrderStatus.CLOSED, OrderStatus.CANCELLED_BY_CUSTOMER), false);
});

test('DISPUTED is deliberately unreachable (no dispute-resolution flow yet)', () => {
  for (const from of Object.values(OrderStatus)) {
    assert.equal(canTransition(from, OrderStatus.DISPUTED), false, from);
  }
});

// ─────────────── Batch 2: master cancellation (penalty engine trigger) ───────────────

test('a master can cancel from ASSIGNED or EN_ROUTE', () => {
  assert.equal(canTransition(OrderStatus.ASSIGNED, OrderStatus.CANCELLED_BY_MASTER), true);
  assert.equal(canTransition(OrderStatus.EN_ROUTE, OrderStatus.CANCELLED_BY_MASTER), true);
});

test('a master cannot cancel once IN_PROGRESS or from any other status', () => {
  for (const from of Object.values(OrderStatus)) {
    if (from === OrderStatus.ASSIGNED || from === OrderStatus.EN_ROUTE) continue;
    assert.equal(canTransition(from, OrderStatus.CANCELLED_BY_MASTER), false, from);
  }
});

test('ACTIVE_MASTER_JOB_STATUSES covers the whole occupied window, not just ASSIGNED', () => {
  const expected: OrderStatus[] = [
    OrderStatus.ASSIGNED,
    OrderStatus.EN_ROUTE,
    OrderStatus.IN_PROGRESS,
    OrderStatus.COMPLETED,
  ];
  assert.deepEqual(ACTIVE_MASTER_JOB_STATUSES, expected);
  assert.ok(!ACTIVE_MASTER_JOB_STATUSES.includes(OrderStatus.CLOSED), 'CLOSED moves to job history, not "current job"');
});
