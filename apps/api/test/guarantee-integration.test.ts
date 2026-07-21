/**
 * DB-touching tests for GuaranteeService eligibility rules and lifecycle —
 * CLOSED order + VERIFIED master + a SUCCEEDED payment must all be true,
 * one claim per order, and the admin-ready decide() transition.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { GuaranteeService } from '../src/modules/guarantee/guarantee.service';

const prisma = new PrismaService();
const stubNotifications = { notify: async () => {} };
const guarantee = new GuaranteeService(prisma, stubNotifications as never);
const fakeAdminId = randomUUID();

let categoryId: string;
let customerId: string;
let verifiedMasterId: string;
let unverifiedMasterId: string;
const orderIds: string[] = [];
const userIds: string[] = [];

before(async () => {
  const suffix = randomUUID().slice(0, 8);
  const category = await prisma.serviceCategory.create({
    data: { slug: `guarantee-test-${suffix}`, nameUz: 'Test', nameRu: 'Test', basePriceMin: 50_000, basePriceMax: 100_000 },
  });
  categoryId = category.id;

  const customer = await prisma.user.create({
    data: { phone: `+998960${suffix.slice(0, 6)}`, passwordHash: 'x', role: 'CUSTOMER', status: 'ACTIVE', referralCode: `GC${suffix}`.slice(0, 20) },
  });
  customerId = customer.id;
  userIds.push(customerId);

  const verifiedMaster = await prisma.user.create({
    data: { phone: `+998961${suffix.slice(0, 6)}`, passwordHash: 'x', role: 'MASTER', status: 'ACTIVE', referralCode: `GM${suffix}`.slice(0, 20) },
  });
  verifiedMasterId = verifiedMaster.id;
  userIds.push(verifiedMasterId);
  await prisma.masterProfile.create({ data: { userId: verifiedMasterId, verificationStatus: 'VERIFIED' } });

  const unverifiedMaster = await prisma.user.create({
    data: { phone: `+998962${suffix.slice(0, 6)}`, passwordHash: 'x', role: 'MASTER', status: 'ACTIVE', referralCode: `GU${suffix}`.slice(0, 20) },
  });
  unverifiedMasterId = unverifiedMaster.id;
  userIds.push(unverifiedMasterId);
  await prisma.masterProfile.create({ data: { userId: unverifiedMasterId, verificationStatus: 'UNVERIFIED' } });
});

after(async () => {
  await prisma.guaranteeClaim.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.masterProfile.deleteMany({ where: { userId: { in: [verifiedMasterId, unverifiedMasterId] } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.serviceCategory.deleteMany({ where: { id: categoryId } });
  await prisma.$disconnect();
});

async function makeOrder(masterId: string, status: string): Promise<string> {
  const order = await prisma.order.create({
    data: { customerId, categoryId, masterId, description: 'guarantee test order', status: status as never, addressText: 'test' },
  });
  orderIds.push(order.id);
  return order.id;
}

async function addSucceededPayment(orderId: string): Promise<void> {
  await prisma.payment.create({
    data: {
      orderId,
      customerId,
      method: 'MOCK',
      status: 'SUCCEEDED',
      amount: 100_000,
      platformFee: 0,
      taxRate: 0.01,
      taxAmount: 1_000,
      masterNetAmount: 99_000,
      succeededAt: new Date(),
    },
  });
}

test('eligibility: rejects a claim on an order that is not CLOSED', async () => {
  const orderId = await makeOrder(verifiedMasterId, 'COMPLETED');
  await addSucceededPayment(orderId);
  await assert.rejects(() => guarantee.fileClaim(customerId, orderId, 'Ish sifatsiz bajarildi'));
});

test('eligibility: rejects a claim when the master is not VERIFIED', async () => {
  const orderId = await makeOrder(unverifiedMasterId, 'CLOSED');
  await addSucceededPayment(orderId);
  await assert.rejects(() => guarantee.fileClaim(customerId, orderId, 'Ish sifatsiz bajarildi'));
});

test('eligibility: rejects a claim when no successful payment exists', async () => {
  const orderId = await makeOrder(verifiedMasterId, 'CLOSED');
  await assert.rejects(() => guarantee.fileClaim(customerId, orderId, 'Ish sifatsiz bajarildi'));
});

test('happy path: a CLOSED order, VERIFIED master, and SUCCEEDED payment is claimable', async () => {
  const orderId = await makeOrder(verifiedMasterId, 'CLOSED');
  await addSucceededPayment(orderId);
  const claim = await guarantee.fileClaim(customerId, orderId, 'Ish sifatsiz bajarildi, qayta ishlash kerak');
  assert.equal(claim.status, 'OPEN');
  assert.equal(claim.orderId, orderId);
});

test('one claim per order — a second attempt is rejected', async () => {
  const orderId = await makeOrder(verifiedMasterId, 'CLOSED');
  await addSucceededPayment(orderId);
  await guarantee.fileClaim(customerId, orderId, 'Birinchi shikoyat matni bu yerda');
  await assert.rejects(() => guarantee.fileClaim(customerId, orderId, 'Ikkinchi urinish matni'));
});

test('admin decide() transitions OPEN -> APPROVED/REJECTED and is final', async () => {
  const orderId = await makeOrder(verifiedMasterId, 'CLOSED');
  await addSucceededPayment(orderId);
  const claim = await guarantee.fileClaim(customerId, orderId, 'Yana bir shikoyat matni bu yerda');

  const decided = await guarantee.decide(claim.id, fakeAdminId, true, 'Tasdiqlandi, pul qaytariladi');
  assert.equal(decided.status, 'APPROVED');
  assert.ok(decided.decidedAt);

  await assert.rejects(() => guarantee.decide(claim.id, fakeAdminId, false));
});
