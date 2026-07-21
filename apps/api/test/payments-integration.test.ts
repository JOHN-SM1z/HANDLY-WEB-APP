/**
 * DB-touching correctness tests for M5 payments against the real
 * PaymentsService (not reimplemented logic) and the real dev Postgres — same
 * rationale as dispatch-integration.test.ts / order-execution-integration.test.ts:
 * the properties being verified (the FOR-UPDATE-guarded duplicate-payment
 * race fix, and webhook idempotency) only mean something against real DB
 * state, not mocks.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { AppConfig } from '../src/infra/config/app-config';
import { loadEnv } from '../src/infra/config/env';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { MockPaymentProvider } from '../src/infra/payment/mock-payment.provider';
import type { ChargeInput, ChargeResult, PaymentProvider } from '../src/infra/payment/payment-provider';
import { MockTaxProvider } from '../src/modules/tax/mock-tax.provider';
import { PaymentsService } from '../src/modules/payments/payments.service';

const prisma = new PrismaService();
const config = new AppConfig(loadEnv());
const tax = new MockTaxProvider(config);
const stubNotifications = { notify: async () => {} };

const alwaysFailProvider: PaymentProvider = {
  async charge(input: ChargeInput): Promise<ChargeResult> {
    return { success: false, providerRef: `MOCK-FAIL-${randomUUID()}`, failureReason: 'insufficient_funds (test)' };
  },
};

const payments = new PaymentsService(prisma, new MockPaymentProvider(), tax, stubNotifications as never);
const failingPayments = new PaymentsService(prisma, alwaysFailProvider, tax, stubNotifications as never);

let categoryId: string;
let customerId: string;
let masterId: string;
let otherCustomerId: string;
const orderIds: string[] = [];
const userIds: string[] = [];

before(async () => {
  const suffix = randomUUID().slice(0, 8);
  const category = await prisma.serviceCategory.create({
    data: { slug: `m5-test-${suffix}`, nameUz: 'Test', nameRu: 'Test', basePriceMin: 50_000, basePriceMax: 100_000 },
  });
  categoryId = category.id;

  const customer = await prisma.user.create({
    data: { phone: `+998920${suffix.slice(0, 6)}`, passwordHash: 'x', role: 'CUSTOMER', status: 'ACTIVE', referralCode: `PC${suffix}`.slice(0, 20) },
  });
  customerId = customer.id;
  userIds.push(customerId);

  const otherCustomer = await prisma.user.create({
    data: { phone: `+998921${suffix.slice(0, 6)}`, passwordHash: 'x', role: 'CUSTOMER', status: 'ACTIVE', referralCode: `PO${suffix}`.slice(0, 20) },
  });
  otherCustomerId = otherCustomer.id;
  userIds.push(otherCustomerId);

  const master = await prisma.user.create({
    data: { phone: `+998922${suffix.slice(0, 6)}`, passwordHash: 'x', role: 'MASTER', status: 'ACTIVE', referralCode: `PM${suffix}`.slice(0, 20) },
  });
  masterId = master.id;
  userIds.push(masterId);
  await prisma.masterProfile.create({ data: { userId: masterId, verificationStatus: 'VERIFIED', jobsDone: 0 } });
});

after(async () => {
  await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.masterProfile.deleteMany({ where: { userId: masterId } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.serviceCategory.deleteMany({ where: { id: categoryId } });
  await prisma.$disconnect();
});

async function makeCompletedOrder(finalAmount = 280_000, platformFee = 30_000): Promise<string> {
  const order = await prisma.order.create({
    data: {
      customerId,
      categoryId,
      masterId,
      description: 'M5 integration test order',
      status: 'COMPLETED',
      priceMin: 225_000,
      priceMax: 460_000,
      platformFee,
      finalAmount,
      addressText: 'test address',
    },
  });
  orderIds.push(order.id);
  return order.id;
}

test('happy path: initiate charges the correct amount and computes settlement math', async () => {
  const orderId = await makeCompletedOrder(280_000, 30_000);
  const dto = await payments.initiate(customerId, orderId, 'MOCK');

  assert.equal(dto.status, 'SUCCEEDED');
  assert.equal(dto.amount, 280_000);
  assert.equal(dto.platformFee, 30_000);
  // masterGross = 280_000 - 30_000 = 250_000; 1% withheld = 2_500; net = 247_500
  assert.equal(dto.taxAmount, 2_500);
  assert.equal(dto.masterNetAmount, 247_500);
  assert.equal(dto.taxRate, 0.01);
  assert.ok(dto.succeededAt);
});

test('permission check: a different customer cannot pay for someone else\'s order', async () => {
  const orderId = await makeCompletedOrder();
  await assert.rejects(() => payments.initiate(otherCustomerId, orderId, 'MOCK'));
});

test('invalid state: cannot initiate payment before the order is COMPLETED', async () => {
  const order = await prisma.order.create({
    data: {
      customerId,
      categoryId,
      masterId,
      description: 'M5 test — not yet completed',
      status: 'IN_PROGRESS',
      priceMin: 225_000,
      priceMax: 460_000,
      platformFee: 30_000,
      addressText: 'test address',
    },
  });
  orderIds.push(order.id);
  await assert.rejects(() => payments.initiate(customerId, order.id, 'MOCK'));
});

test('duplicate payment protection: a second initiate after a SUCCEEDED payment is rejected', async () => {
  const orderId = await makeCompletedOrder();
  const first = await payments.initiate(customerId, orderId, 'MOCK');
  assert.equal(first.status, 'SUCCEEDED');
  await assert.rejects(() => payments.initiate(customerId, orderId, 'MOCK'));

  const all = await prisma.payment.findMany({ where: { orderId } });
  assert.equal(all.length, 1, 'exactly one payment row must exist for this order');
});

test('concurrent duplicate action: two simultaneous initiate calls on the same order — exactly one succeeds', async () => {
  const orderId = await makeCompletedOrder();
  const results = await Promise.allSettled([
    payments.initiate(customerId, orderId, 'MOCK'),
    payments.initiate(customerId, orderId, 'MOCK'),
  ]);
  const succeeded = results.filter((r) => r.status === 'fulfilled');
  const failed = results.filter((r) => r.status === 'rejected');
  assert.equal(succeeded.length, 1, 'exactly one of the two concurrent initiate calls should succeed');
  assert.equal(failed.length, 1, 'the other must be rejected as a conflict, not create a second charge');

  const all = await prisma.payment.findMany({ where: { orderId } });
  assert.equal(all.length, 1, 'exactly one payment row must exist — the FOR UPDATE lock prevented a double charge');
});

test('failure handling: a declined charge is recorded as FAILED with a reason, not silently treated as success', async () => {
  const orderId = await makeCompletedOrder();
  const dto = await failingPayments.initiate(customerId, orderId, 'MOCK');
  assert.equal(dto.status, 'FAILED');
  assert.equal(dto.failureReason, 'insufficient_funds (test)');
  assert.equal(dto.succeededAt, null);
});

test('webhook idempotency: a second webhook call for an already-settled payment is a no-op', async () => {
  const orderId = await makeCompletedOrder();
  // Create a PROCESSING payment directly (bypassing initiate) to simulate the
  // async-provider case the webhook path exists for.
  const pending = await prisma.payment.create({
    data: {
      orderId,
      customerId,
      method: 'MOCK',
      status: 'PROCESSING',
      amount: 280_000,
      platformFee: 30_000,
      taxRate: 0.01,
      taxAmount: 2_500,
      masterNetAmount: 247_500,
      providerRef: `webhook-test-${randomUUID()}`,
    },
  });

  await payments.handleWebhook(pending.providerRef!, true);
  const afterFirst = await prisma.payment.findUniqueOrThrow({ where: { id: pending.id } });
  assert.equal(afterFirst.status, 'SUCCEEDED');
  const firstSucceededAt = afterFirst.succeededAt;

  // Replay — must not re-settle or throw.
  await payments.handleWebhook(pending.providerRef!, true);
  const afterSecond = await prisma.payment.findUniqueOrThrow({ where: { id: pending.id } });
  assert.equal(afterSecond.status, 'SUCCEEDED');
  assert.deepEqual(afterSecond.succeededAt, firstSucceededAt, 'timestamp must not change on a replayed webhook');
});

test('getMasterEarnings sums only SUCCEEDED payments for this master\'s orders', async () => {
  const before = await payments.getMasterEarnings(masterId);
  const orderId = await makeCompletedOrder(200_000, 30_000);
  await payments.initiate(customerId, orderId, 'MOCK');
  const failedOrderId = await makeCompletedOrder(200_000, 30_000);
  await failingPayments.initiate(customerId, failedOrderId, 'MOCK');

  const after = await payments.getMasterEarnings(masterId);
  // masterGross = 200_000 - 30_000 = 170_000; net = 170_000 - 1700 = 168_300
  assert.equal(after.summary.jobsPaid, before.summary.jobsPaid + 1, 'only the SUCCEEDED payment should count');
  assert.equal(after.summary.totalNetAmount, before.summary.totalNetAmount + 168_300);
});
