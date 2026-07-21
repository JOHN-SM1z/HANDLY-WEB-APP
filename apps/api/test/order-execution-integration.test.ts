/**
 * DB-touching correctness tests for M4 job-execution against the real
 * OrdersService (not reimplemented logic) and the real dev Postgres — same
 * rationale as dispatch-integration.test.ts: the properties being verified
 * (permission checks reading real ownership, and the guarded-update race fix)
 * only mean something against real DB state, not mocks.
 *
 * AI/dispatch aren't exercised by any job-execution method, so they're
 * stubbed; realtime/notifications are stubbed to no-ops since only their
 * *being called without throwing* matters here, not delivery — delivery
 * itself is already covered by M3's own tests.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import { AppConfig } from '../src/infra/config/app-config';
import { loadEnv } from '../src/infra/config/env';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { OrdersService } from '../src/modules/orders/orders.service';

const prisma = new PrismaService();
const config = new AppConfig(loadEnv());
const stubGateway = { emitToUser: () => {} };
const stubNotifications = { notify: async () => {} };

const orders = new OrdersService(
  prisma,
  config,
  {} as never, // AiService — unused by job-execution methods
  {} as never, // DispatchService — unused by job-execution methods
  stubGateway as never,
  stubNotifications as never,
  {} as never, // StorageProvider — unused by job-execution methods
);

let categoryId: string;
let customerId: string;
let masterId: string;
let otherMasterId: string;
const orderIds: string[] = [];
const otherUserIds: string[] = [];

before(async () => {
  const suffix = randomUUID().slice(0, 8);
  const category = await prisma.serviceCategory.create({
    data: { slug: `m4-test-${suffix}`, nameUz: 'Test', nameRu: 'Test', basePriceMin: 50_000, basePriceMax: 100_000 },
  });
  categoryId = category.id;

  const customer = await prisma.user.create({
    data: { phone: `+998910${suffix.slice(0, 6)}`, passwordHash: 'x', role: 'CUSTOMER', status: 'ACTIVE', referralCode: `TC${suffix}`.slice(0, 20) },
  });
  customerId = customer.id;

  const master = await prisma.user.create({
    data: { phone: `+998911${suffix.slice(0, 6)}`, passwordHash: 'x', role: 'MASTER', status: 'ACTIVE', referralCode: `TM${suffix}`.slice(0, 20) },
  });
  masterId = master.id;
  await prisma.masterProfile.create({ data: { userId: masterId, verificationStatus: 'VERIFIED', jobsDone: 0 } });

  const otherMaster = await prisma.user.create({
    data: { phone: `+998912${suffix.slice(0, 6)}`, passwordHash: 'x', role: 'MASTER', status: 'ACTIVE', referralCode: `TO${suffix}`.slice(0, 20) },
  });
  otherMasterId = otherMaster.id;
  await prisma.masterProfile.create({ data: { userId: otherMasterId, verificationStatus: 'VERIFIED', jobsDone: 0 } });
});

after(async () => {
  await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  const allMasterIds = [masterId, otherMasterId, ...otherUserIds];
  await prisma.masterProfile.deleteMany({ where: { userId: { in: allMasterIds } } });
  await prisma.user.deleteMany({ where: { id: { in: [...allMasterIds, customerId] } } });
  await prisma.serviceCategory.deleteMany({ where: { id: categoryId } });
  await prisma.$disconnect();
});

async function makeAssignedOrder(forMasterId: string = masterId): Promise<string> {
  const order = await prisma.order.create({
    data: {
      customerId,
      categoryId,
      masterId: forMasterId,
      description: 'M4 integration test order',
      status: 'ASSIGNED',
      priceMin: 50_000,
      priceMax: 100_000,
      addressText: 'test address',
    },
  });
  orderIds.push(order.id);
  return order.id;
}

/** A fresh master with no other orders — for tests asserting an exact single "current job". */
async function makeIsolatedMaster(): Promise<string> {
  const suffix = randomUUID().slice(0, 8);
  const user = await prisma.user.create({
    data: { phone: `+998913${suffix.slice(0, 6)}`, passwordHash: 'x', role: 'MASTER', status: 'ACTIVE', referralCode: `TI${suffix}`.slice(0, 20) },
  });
  await prisma.masterProfile.create({ data: { userId: user.id, verificationStatus: 'VERIFIED', jobsDone: 0 } });
  otherUserIds.push(user.id);
  return user.id;
}

test('happy path: ASSIGNED -> EN_ROUTE -> IN_PROGRESS -> COMPLETED -> CLOSED', async () => {
  const orderId = await makeAssignedOrder();

  const enRoute = await orders.startEnRoute(masterId, orderId);
  assert.equal(enRoute.status, 'EN_ROUTE');

  const started = await orders.startService(masterId, orderId);
  assert.equal(started.status, 'IN_PROGRESS');

  const completed = await orders.completeService(masterId, orderId, 75_000);
  assert.equal(completed.status, 'COMPLETED');
  assert.equal(completed.finalAmount, 75_000);

  const before = await prisma.masterProfile.findUniqueOrThrow({ where: { userId: masterId } });
  const closed = await orders.confirmCompletion(customerId, orderId);
  assert.equal(closed.status, 'CLOSED');
  const after = await prisma.masterProfile.findUniqueOrThrow({ where: { userId: masterId } });
  assert.equal(after.jobsDone, before.jobsDone + 1, 'jobsDone increments exactly once on customer confirmation');

  const history = await prisma.orderStatusHistory.findMany({ where: { orderId } });
  const toStatuses = history.map((h) => h.toStatus);
  assert.deepEqual(toStatuses, ['EN_ROUTE', 'IN_PROGRESS', 'COMPLETED', 'CLOSED']);
});

test('completeService rejects a finalAmount outside the quoted [priceMin, priceMax] range', async () => {
  const orderId = await makeAssignedOrder();
  await orders.startEnRoute(masterId, orderId);
  await orders.startService(masterId, orderId);
  await assert.rejects(() => orders.completeService(masterId, orderId, 500_000));
  await assert.rejects(() => orders.completeService(masterId, orderId, 1));
});

test('permission check: a master who is not assigned to the order is forbidden from acting on it', async () => {
  const orderId = await makeAssignedOrder();
  await assert.rejects(() => orders.startEnRoute(otherMasterId, orderId), ForbiddenException);
});

test('invalid transition: cannot start service before going en route', async () => {
  const orderId = await makeAssignedOrder();
  await assert.rejects(() => orders.startService(masterId, orderId));
});

test('invalid transition: cannot complete a job still at ASSIGNED', async () => {
  const orderId = await makeAssignedOrder();
  await assert.rejects(() => orders.completeService(masterId, orderId, 75_000));
});

test('customer confirmation is rejected before the master marks the job COMPLETED', async () => {
  const orderId = await makeAssignedOrder();
  await orders.startEnRoute(masterId, orderId);
  await assert.rejects(() => orders.confirmCompletion(customerId, orderId));
});

test('concurrent duplicate action: two simultaneous "start en route" calls — exactly one succeeds', async () => {
  const orderId = await makeAssignedOrder();
  const results = await Promise.allSettled([
    orders.startEnRoute(masterId, orderId),
    orders.startEnRoute(masterId, orderId),
  ]);
  const succeeded = results.filter((r) => r.status === 'fulfilled');
  const failed = results.filter((r) => r.status === 'rejected');
  assert.equal(succeeded.length, 1, 'exactly one of the two concurrent calls should succeed');
  assert.equal(failed.length, 1, 'the other must be rejected as a conflict, not silently duplicate');

  const history = await prisma.orderStatusHistory.findMany({ where: { orderId, toStatus: 'EN_ROUTE' } });
  assert.equal(history.length, 1, 'exactly one EN_ROUTE statusHistory row must exist, not two');
});

test('concurrent duplicate action: two simultaneous "complete" calls — exactly one succeeds, no double notification path', async () => {
  const orderId = await makeAssignedOrder();
  await orders.startEnRoute(masterId, orderId);
  await orders.startService(masterId, orderId);

  const results = await Promise.allSettled([
    orders.completeService(masterId, orderId, 60_000),
    orders.completeService(masterId, orderId, 90_000),
  ]);
  const succeeded = results.filter((r) => r.status === 'fulfilled');
  assert.equal(succeeded.length, 1, 'exactly one concurrent completeService call should succeed');

  const finalOrder = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  assert.equal(finalOrder.status, 'COMPLETED');
  assert.ok(
    finalOrder.finalAmount === 60_000 || finalOrder.finalAmount === 90_000,
    'finalAmount must be from exactly the winning call, not corrupted by the loser',
  );

  const history = await prisma.orderStatusHistory.findMany({ where: { orderId, toStatus: 'COMPLETED' } });
  assert.equal(history.length, 1, 'exactly one COMPLETED statusHistory row — no duplicate notification/history');
});

test('getCurrentJob returns the order through EN_ROUTE/IN_PROGRESS/COMPLETED but not after CLOSED', async () => {
  const isolatedMaster = await makeIsolatedMaster();
  const orderId = await makeAssignedOrder(isolatedMaster);
  assert.equal((await orders.getCurrentJob(isolatedMaster))?.id, orderId);

  await orders.startEnRoute(isolatedMaster, orderId);
  assert.equal((await orders.getCurrentJob(isolatedMaster))?.id, orderId);

  await orders.startService(isolatedMaster, orderId);
  assert.equal((await orders.getCurrentJob(isolatedMaster))?.id, orderId);

  await orders.completeService(isolatedMaster, orderId, 75_000);
  assert.equal(
    (await orders.getCurrentJob(isolatedMaster))?.id,
    orderId,
    'still "current" while awaiting customer confirmation',
  );

  await orders.confirmCompletion(customerId, orderId);
  assert.equal(await orders.getCurrentJob(isolatedMaster), null, 'no longer current once CLOSED — moved to job history');
});

test('getJobHistory lists COMPLETED and CLOSED jobs for the master', async () => {
  const isolatedMaster = await makeIsolatedMaster();
  const orderId = await makeAssignedOrder(isolatedMaster);
  await orders.startEnRoute(isolatedMaster, orderId);
  await orders.startService(isolatedMaster, orderId);
  await orders.completeService(isolatedMaster, orderId, 75_000);

  const historyBeforeClose = await orders.getJobHistory(isolatedMaster);
  assert.ok(historyBeforeClose.items.some((o) => o.id === orderId), 'COMPLETED job should already show in history');

  await orders.confirmCompletion(customerId, orderId);
  const historyAfterClose = await orders.getJobHistory(isolatedMaster);
  const found = historyAfterClose.items.find((o) => o.id === orderId);
  assert.ok(found);
  assert.equal(found!.status, 'CLOSED');
});
