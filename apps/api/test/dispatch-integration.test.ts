/**
 * DB-touching correctness tests for the two riskiest properties in the
 * dispatch engine: the accept-race lock and offer-expiry idempotency. These
 * run against the real dev Postgres (same as the app does at runtime) rather
 * than mocks — Postgres's actual FOR UPDATE lock semantics are the thing
 * being verified, and no fake/in-memory DB would prove anything about them.
 * Exercises the exact SQL patterns DispatchService.acceptOffer/
 * handleOfferExpiry use, rather than constructing the full service (which
 * would need the entire app's DI graph built by hand for no extra safety
 * signal — the correctness lives in the SQL, not the surrounding plumbing).
 *
 * Requires DATABASE_URL (loaded via the root .env, same as every other
 * script) and a live PostGIS-enabled Postgres — see CLAUDE.md "Running locally".
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { findEligibleCandidates } from '../src/modules/dispatch/dispatch-eligibility';

const prisma = new PrismaService();

// Tashkent-ish coordinates, close enough together to be within a 5km radius.
const ORDER_LOCATION = { lat: 41.2995, lng: 69.2401 };
const MASTER_NEARBY = { lat: 41.31, lng: 69.25 }; // ~1.5km away
const MASTER_FAR = { lat: 41.55, lng: 69.6 }; // ~40km away

let categoryId: string;
let customerId: string;
let orderId: string;
let busyOrderId: string | undefined;
const masterIds: string[] = [];

before(async () => {
  const suffix = randomUUID().slice(0, 8);
  const category = await prisma.serviceCategory.create({
    data: {
      slug: `m3-test-${suffix}`,
      nameUz: 'Test',
      nameRu: 'Test',
      basePriceMin: 50_000,
      basePriceMax: 100_000,
    },
  });
  categoryId = category.id;

  const customer = await prisma.user.create({
    data: {
      phone: `+998900${suffix.slice(0, 6)}`,
      passwordHash: 'x',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      referralCode: `TESTC${suffix}`.slice(0, 20),
    },
  });
  customerId = customer.id;

  const order = await prisma.order.create({
    data: {
      customerId,
      categoryId,
      description: 'M3 integration test order',
      status: 'SEARCHING',
      latitude: ORDER_LOCATION.lat,
      longitude: ORDER_LOCATION.lng,
      addressText: 'test address',
    },
  });
  orderId = order.id;
});

after(async () => {
  // Reverse-dependency order.
  if (busyOrderId) await prisma.order.deleteMany({ where: { id: busyOrderId } });
  await prisma.orderDispatch.deleteMany({ where: { orderId } });
  await prisma.order.deleteMany({ where: { id: orderId } });
  await prisma.serviceArea.deleteMany({ where: { masterId: { in: masterIds } } });
  await prisma.masterSkill.deleteMany({ where: { masterId: { in: masterIds } } });
  await prisma.masterProfile.deleteMany({ where: { userId: { in: masterIds } } });
  await prisma.user.deleteMany({ where: { id: { in: [...masterIds, customerId] } } });
  await prisma.serviceCategory.deleteMany({ where: { id: categoryId } });
  await prisma.$disconnect();
});

async function makeMaster(opts: {
  lat: number;
  lng: number;
  radiusM: number;
  isOnline: boolean;
  trustTier?: number;
}): Promise<string> {
  const suffix = randomUUID().slice(0, 8);
  const user = await prisma.user.create({
    data: {
      phone: `+998901${suffix.slice(0, 6)}`,
      passwordHash: 'x',
      role: 'MASTER',
      status: 'ACTIVE',
      referralCode: `TESTM${suffix}`.slice(0, 20),
    },
  });
  masterIds.push(user.id);
  await prisma.masterProfile.create({
    data: {
      userId: user.id,
      verificationStatus: 'VERIFIED',
      isOnline: opts.isOnline,
      trustTier: opts.trustTier ?? 0,
      ratingAvg: 4.5,
      jobsDone: 10,
    },
  });
  await prisma.masterSkill.create({ data: { masterId: user.id, categoryId } });
  await prisma.serviceArea.create({
    data: { masterId: user.id, label: 'test', centerLat: opts.lat, centerLng: opts.lng, radiusM: opts.radiusM },
  });
  return user.id;
}

test('findEligibleCandidates finds an online, in-range, verified master and excludes a far one', async () => {
  const near = await makeMaster({ ...MASTER_NEARBY, radiusM: 5000, isOnline: true });
  const far = await makeMaster({ ...MASTER_FAR, radiusM: 5000, isOnline: true });

  const candidates = await findEligibleCandidates(prisma, {
    orderId,
    categoryId,
    requiredTier: 0,
    todayDateStr: '2099-01-01', // far future — guarantees no BUSY/BOOKED row collides
    radiusMultiplier: 1,
    limit: 5,
  });

  const ids = candidates.map((c) => c.masterId);
  assert.ok(ids.includes(near), 'nearby master should be eligible');
  assert.ok(!ids.includes(far), 'far master should not be eligible at 1x radius');
  const nearRow = candidates.find((c) => c.masterId === near)!;
  assert.ok(nearRow.distanceM > 0 && nearRow.distanceM < 5000);
});

test('findEligibleCandidates excludes an offline master', async () => {
  const offline = await makeMaster({ ...MASTER_NEARBY, radiusM: 5000, isOnline: false });
  const candidates = await findEligibleCandidates(prisma, {
    orderId,
    categoryId,
    requiredTier: 0,
    todayDateStr: '2099-01-01',
    radiusMultiplier: 1,
    limit: 5,
  });
  assert.ok(!candidates.some((c) => c.masterId === offline));
});

test('findEligibleCandidates excludes a master below the required trust tier', async () => {
  const t0 = await makeMaster({ ...MASTER_NEARBY, radiusM: 5000, isOnline: true, trustTier: 0 });
  const candidates = await findEligibleCandidates(prisma, {
    orderId,
    categoryId,
    requiredTier: 2, // this order needs COMPLEX-tier masters
    todayDateStr: '2099-01-01',
    radiusMultiplier: 1,
    limit: 5,
  });
  assert.ok(!candidates.some((c) => c.masterId === t0));
});

test('findEligibleCandidates excludes a master currently working another ASSIGNED job', async () => {
  const busy = await makeMaster({ ...MASTER_NEARBY, radiusM: 5000, isOnline: true });
  const busyOrder = await prisma.order.create({
    data: {
      customerId,
      categoryId,
      description: 'M3 integration test — other job keeping a master busy',
      status: 'ASSIGNED',
      masterId: busy,
      latitude: MASTER_NEARBY.lat,
      longitude: MASTER_NEARBY.lng,
      addressText: 'test address 2',
    },
  });
  busyOrderId = busyOrder.id;

  const candidates = await findEligibleCandidates(prisma, {
    orderId,
    categoryId,
    requiredTier: 0,
    todayDateStr: '2099-01-01',
    radiusMultiplier: 1,
    limit: 5,
  });
  assert.ok(
    !candidates.some((c) => c.masterId === busy),
    'a master already ASSIGNED to another order should not be offered a new one',
  );
});

test('radiusMultiplier widens eligibility on the expanded retry', async () => {
  const mid = await makeMaster({ lat: 41.34, lng: 69.28, radiusM: 3000, isOnline: true }); // ~6km away, outside a 3km radius
  const atNormalRadius = await findEligibleCandidates(prisma, {
    orderId,
    categoryId,
    requiredTier: 0,
    todayDateStr: '2099-01-01',
    radiusMultiplier: 1,
    limit: 5,
  });
  assert.ok(!atNormalRadius.some((c) => c.masterId === mid), 'should be out of range at 1x');

  const atExpandedRadius = await findEligibleCandidates(prisma, {
    orderId,
    categoryId,
    requiredTier: 0,
    todayDateStr: '2099-01-01',
    radiusMultiplier: 3, // 3x of 3000m = 9000m, comfortably covers ~6km
    limit: 5,
  });
  assert.ok(atExpandedRadius.some((c) => c.masterId === mid), 'should be in range once the radius expands');
});

test('accept race: exactly one of two concurrent FOR UPDATE transactions on the same order wins', async () => {
  const m1 = await makeMaster({ ...MASTER_NEARBY, radiusM: 5000, isOnline: true });
  const m2 = await makeMaster({ ...MASTER_NEARBY, radiusM: 5000, isOnline: true });
  const d1 = await prisma.orderDispatch.create({
    data: { orderId, masterId: m1, rankInCascade: 1, distanceM: 100, score: 0.9, expiresAt: new Date(Date.now() + 60_000) },
  });
  const d2 = await prisma.orderDispatch.create({
    data: { orderId, masterId: m2, rankInCascade: 2, distanceM: 200, score: 0.8, expiresAt: new Date(Date.now() + 60_000) },
  });

  // Reset the order to SEARCHING for this test (earlier tests didn't touch status).
  await prisma.order.update({ where: { id: orderId }, data: { status: 'SEARCHING', masterId: null } });

  const tryAccept = (dispatchId: string, masterId: string) =>
    prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      if (order.status !== 'SEARCHING') throw new Error('already assigned');
      await tx.orderDispatch.update({ where: { id: dispatchId }, data: { status: 'ACCEPTED' } });
      await tx.order.update({ where: { id: orderId }, data: { status: 'ASSIGNED', masterId } });
    });

  const results = await Promise.allSettled([tryAccept(d1.id, m1), tryAccept(d2.id, m2)]);
  const succeeded = results.filter((r) => r.status === 'fulfilled');
  const failed = results.filter((r) => r.status === 'rejected');
  assert.equal(succeeded.length, 1, 'exactly one accept should succeed');
  assert.equal(failed.length, 1, 'exactly one accept should be rejected');

  const finalOrder = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  assert.equal(finalOrder.status, 'ASSIGNED');
  assert.ok([m1, m2].includes(finalOrder.masterId!));
});

test('offer-expiry guard is idempotent — a second call on an already-non-OFFERED dispatch is a no-op', async () => {
  const m3 = await makeMaster({ ...MASTER_NEARBY, radiusM: 5000, isOnline: true });
  const dispatch = await prisma.orderDispatch.create({
    data: { orderId, masterId: m3, rankInCascade: 3, distanceM: 100, score: 0.5, expiresAt: new Date() },
  });

  const first = await prisma.orderDispatch.updateMany({
    where: { id: dispatch.id, status: 'OFFERED' },
    data: { status: 'EXPIRED' },
  });
  assert.equal(first.count, 1, 'first expiry should update exactly one row');

  const second = await prisma.orderDispatch.updateMany({
    where: { id: dispatch.id, status: 'OFFERED' },
    data: { status: 'EXPIRED' },
  });
  assert.equal(second.count, 0, 'second expiry call must be a no-op — this is what makes it safe under BullMQ retries');
});
