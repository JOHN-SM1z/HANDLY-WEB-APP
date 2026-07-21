/**
 * DB-touching tests for ReviewsService — verifies ratingAvg is recomputed
 * from real reviews (replacing the old static/seed-only value), the
 * one-review-per-order guard, and the low-rating -> customer-complaint
 * penalty trigger.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { TrustService } from '../src/modules/trust/trust.service';
import { PenaltiesService } from '../src/modules/penalties/penalties.service';
import { ReviewsService } from '../src/modules/reviews/reviews.service';

const prisma = new PrismaService();
const trust = new TrustService(prisma);
const stubNotifications = { notify: async () => {} };
const penalties = new PenaltiesService(prisma, trust, stubNotifications as never);
const reviews = new ReviewsService(prisma, trust, penalties);

let categoryId: string;
let customerId: string;
let otherCustomerId: string;
let masterId: string;
const orderIds: string[] = [];

before(async () => {
  const suffix = randomUUID().slice(0, 8);
  const category = await prisma.serviceCategory.create({
    data: { slug: `review-test-${suffix}`, nameUz: 'Test', nameRu: 'Test', basePriceMin: 50_000, basePriceMax: 100_000 },
  });
  categoryId = category.id;

  const customer = await prisma.user.create({
    data: { phone: `+998950${suffix.slice(0, 6)}`, passwordHash: 'x', role: 'CUSTOMER', status: 'ACTIVE', referralCode: `RC${suffix}`.slice(0, 20) },
  });
  customerId = customer.id;

  const otherCustomer = await prisma.user.create({
    data: { phone: `+998951${suffix.slice(0, 6)}`, passwordHash: 'x', role: 'CUSTOMER', status: 'ACTIVE', referralCode: `RO${suffix}`.slice(0, 20) },
  });
  otherCustomerId = otherCustomer.id;

  const master = await prisma.user.create({
    data: { phone: `+998952${suffix.slice(0, 6)}`, passwordHash: 'x', role: 'MASTER', status: 'ACTIVE', referralCode: `RM${suffix}`.slice(0, 20) },
  });
  masterId = master.id;
  await prisma.masterProfile.create({ data: { userId: masterId, verificationStatus: 'VERIFIED', jobsDone: 0, ratingAvg: 0 } });
});

after(async () => {
  await prisma.review.deleteMany({ where: { masterId } });
  await prisma.penaltyRecord.deleteMany({ where: { masterId } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.masterProfile.deleteMany({ where: { userId: masterId } });
  await prisma.user.deleteMany({ where: { id: { in: [masterId, customerId, otherCustomerId] } } });
  await prisma.serviceCategory.deleteMany({ where: { id: categoryId } });
  await prisma.$disconnect();
});

async function makeClosedOrder(): Promise<string> {
  const order = await prisma.order.create({
    data: { customerId, categoryId, masterId, description: 'review test order', status: 'CLOSED', addressText: 'test' },
  });
  orderIds.push(order.id);
  return order.id;
}

test('creating a review recomputes MasterProfile.ratingAvg from real review data', async () => {
  const orderId = await makeClosedOrder();
  await reviews.create(customerId, orderId, 5);
  const master = await prisma.masterProfile.findUniqueOrThrow({ where: { userId: masterId } });
  assert.equal(Number(master.ratingAvg), 5);

  const orderId2 = await makeClosedOrder();
  await reviews.create(customerId, orderId2, 3);
  const master2 = await prisma.masterProfile.findUniqueOrThrow({ where: { userId: masterId } });
  assert.equal(Number(master2.ratingAvg), 4); // avg(5, 3) = 4
});

test('permission check: only the order\'s own customer can review it', async () => {
  const orderId = await makeClosedOrder();
  await assert.rejects(() => reviews.create(otherCustomerId, orderId, 5));
});

test('invalid state: cannot review an order that is not CLOSED', async () => {
  const order = await prisma.order.create({
    data: { customerId, categoryId, masterId, description: 'not closed', status: 'IN_PROGRESS', addressText: 'test' },
  });
  orderIds.push(order.id);
  await assert.rejects(() => reviews.create(customerId, order.id, 5));
});

test('one review per order — a second review attempt is rejected', async () => {
  const orderId = await makeClosedOrder();
  await reviews.create(customerId, orderId, 4);
  await assert.rejects(() => reviews.create(customerId, orderId, 5));
});

test('a low rating (<=2) also records a CUSTOMER_COMPLAINT penalty', async () => {
  const before = await prisma.penaltyRecord.count({ where: { masterId, eventType: 'CUSTOMER_COMPLAINT' } });
  const orderId = await makeClosedOrder();
  await reviews.create(customerId, orderId, 1);
  const after = await prisma.penaltyRecord.count({ where: { masterId, eventType: 'CUSTOMER_COMPLAINT' } });
  assert.equal(after, before + 1);
});

test('a good rating (>2) does not record a complaint penalty', async () => {
  const before = await prisma.penaltyRecord.count({ where: { masterId, eventType: 'CUSTOMER_COMPLAINT' } });
  const orderId = await makeClosedOrder();
  await reviews.create(customerId, orderId, 4);
  const after = await prisma.penaltyRecord.count({ where: { masterId, eventType: 'CUSTOMER_COMPLAINT' } });
  assert.equal(after, before);
});
