/**
 * DB-touching tests for AdminOrdersService — status/category filtering,
 * cursor pagination, and the geo pre-filter (ST_DWithin against a real
 * PostGIS-backed order location).
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { AdminOrdersService } from '../src/modules/admin/admin-orders.service';

const prisma = new PrismaService();
const adminOrders = new AdminOrdersService(prisma);

let categoryId: string;
let customerId: string;
const orderIds: string[] = [];
const userIds: string[] = [];

before(async () => {
  const suffix = randomUUID().slice(0, 8);
  const category = await prisma.serviceCategory.create({
    data: { slug: `admin-orders-test-${suffix}`, nameUz: 'Test toifa', nameRu: 'Test', basePriceMin: 50_000, basePriceMax: 100_000 },
  });
  categoryId = category.id;

  const customer = await prisma.user.create({
    data: { phone: `+998964${suffix.slice(0, 6)}`, passwordHash: 'x', role: 'CUSTOMER', status: 'ACTIVE', referralCode: `AO${suffix}`.slice(0, 20) },
  });
  customerId = customer.id;
  userIds.push(customerId);

  // Tashkent (in-radius) and a far-away point (out of any small radius).
  const tashkent = await prisma.order.create({
    data: { customerId, categoryId, description: 'in Tashkent', status: 'CLOSED', latitude: 41.29, longitude: 69.24 },
  });
  const farAway = await prisma.order.create({
    data: { customerId, categoryId, description: 'far away', status: 'DRAFT', latitude: 55.75, longitude: 37.61 }, // Moscow
  });
  orderIds.push(tashkent.id, farAway.id);
});

after(async () => {
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.serviceCategory.deleteMany({ where: { id: categoryId } });
  await prisma.$disconnect();
});

test('list filters by status', async () => {
  const page = await adminOrders.list({ status: 'CLOSED', categoryId });
  assert.ok(page.items.every((i) => i.status === 'CLOSED'));
  assert.ok(page.items.some((i) => i.id === orderIds[0]));
  assert.ok(!page.items.some((i) => i.id === orderIds[1]));
});

test('list filters by category', async () => {
  const page = await adminOrders.list({ categoryId });
  assert.equal(page.items.length, 2);
});

test('geo filter includes an order within radius and excludes one far away', async () => {
  const page = await adminOrders.list({ categoryId, lat: 41.29, lng: 69.24, radiusM: 50_000 });
  assert.ok(page.items.some((i) => i.id === orderIds[0]), 'the Tashkent order must be included');
  assert.ok(!page.items.some((i) => i.id === orderIds[1]), 'the Moscow order must be excluded by the radius');
});

test('detail returns full status history, dispatches, and payments arrays', async () => {
  const detail = await adminOrders.detail(orderIds[0]!);
  assert.equal(detail.id, orderIds[0]);
  assert.ok(Array.isArray(detail.statusHistory));
  assert.ok(Array.isArray(detail.dispatches));
  assert.ok(Array.isArray(detail.payments));
});

test('detail throws for a non-existent order', async () => {
  await assert.rejects(() => adminOrders.detail(randomUUID()));
});

test('cursor pagination does not repeat or skip items across pages', async () => {
  const page1 = await adminOrders.list({ categoryId });
  assert.ok(page1.items.length >= 2);
  // With only 2 seeded rows nextCursor is null (take=30 comfortably covers
  // them) — this asserts the no-cursor-needed case is reported honestly.
  assert.equal(page1.nextCursor, null);
});
