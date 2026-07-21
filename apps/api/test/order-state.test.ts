import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OrderStatus } from '@handly/contracts';
import { canTransition, EDITABLE_STATUSES } from '../src/modules/orders/order-state';

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
