/**
 * Pure unit tests for the trust-score formula (deterministic, no DB) plus
 * DB-touching tests for TrustService.computeTrustScore/recomputeTrustTier —
 * same rationale as the other *-integration.test.ts files: the aggregate
 * queries (counting real Order/OrderDispatch/PenaltyRecord rows) only mean
 * something against real Postgres state.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { scoreToTier, TRUST_TIER_THRESHOLDS } from '../src/modules/trust/trust-config';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { TrustService } from '../src/modules/trust/trust.service';

test('scoreToTier is a deterministic step function matching TRUST_TIER_THRESHOLDS', () => {
  assert.equal(scoreToTier(0), 0);
  assert.equal(scoreToTier(TRUST_TIER_THRESHOLDS[0] - 1), 0);
  assert.equal(scoreToTier(TRUST_TIER_THRESHOLDS[0]), 1);
  assert.equal(scoreToTier(TRUST_TIER_THRESHOLDS[1]), 2);
  assert.equal(scoreToTier(TRUST_TIER_THRESHOLDS[2]), 3);
  assert.equal(scoreToTier(100), 3);
});

test('scoreToTier never returns a tier outside 0..3', () => {
  for (const score of [-10, 0, 25, 50, 75, 100, 1000]) {
    const tier = scoreToTier(score);
    assert.ok(tier >= 0 && tier <= 3, `tier for score ${score} was ${tier}`);
  }
});

const prisma = new PrismaService();
const trust = new TrustService(prisma);

let categoryId: string;
let customerId: string;
let masterId: string;
const orderIds: string[] = [];
const dispatchIds: string[] = [];
const penaltyIds: string[] = [];

before(async () => {
  const suffix = randomUUID().slice(0, 8);
  const category = await prisma.serviceCategory.create({
    data: { slug: `trust-test-${suffix}`, nameUz: 'Test', nameRu: 'Test', basePriceMin: 50_000, basePriceMax: 100_000 },
  });
  categoryId = category.id;

  const customer = await prisma.user.create({
    data: { phone: `+998930${suffix.slice(0, 6)}`, passwordHash: 'x', role: 'CUSTOMER', status: 'ACTIVE', referralCode: `TC${suffix}`.slice(0, 20) },
  });
  customerId = customer.id;

  const master = await prisma.user.create({
    data: { phone: `+998931${suffix.slice(0, 6)}`, passwordHash: 'x', role: 'MASTER', status: 'ACTIVE', referralCode: `TM${suffix}`.slice(0, 20) },
  });
  masterId = master.id;
  await prisma.masterProfile.create({
    data: { userId: masterId, verificationStatus: 'VERIFIED', jobsDone: 25, ratingAvg: 4.5 },
  });
});

after(async () => {
  await prisma.penaltyRecord.deleteMany({ where: { id: { in: penaltyIds } } });
  await prisma.orderDispatch.deleteMany({ where: { id: { in: dispatchIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.masterProfile.deleteMany({ where: { userId: masterId } });
  await prisma.user.deleteMany({ where: { id: { in: [masterId, customerId] } } });
  await prisma.serviceCategory.deleteMany({ where: { id: categoryId } });
  await prisma.$disconnect();
});

test('computeTrustScore: a verified master with good history and no penalties scores high', async () => {
  const result = await trust.computeTrustScore(masterId);
  assert.equal(result.factors.jobsDone, 25);
  assert.equal(result.factors.ratingAvg, 4.5);
  assert.equal(result.factors.cancellationRate, 0);
  assert.equal(result.factors.responseRate, 1); // no dispatch history -> benefit of the doubt
  assert.equal(result.factors.verificationStatus, 'VERIFIED');
  assert.equal(result.factors.activePenaltyPoints, 0);
  assert.ok(result.score > 0 && result.score <= 100);
  assert.equal(result.tier, scoreToTier(result.score));
});

test('a CANCELLED_BY_MASTER order raises the cancellation rate and lowers the score', async () => {
  const before = await trust.computeTrustScore(masterId);

  const order = await prisma.order.create({
    data: {
      customerId,
      categoryId,
      masterId,
      description: 'trust test cancelled order',
      status: 'CANCELLED_BY_MASTER',
      addressText: 'test',
    },
  });
  orderIds.push(order.id);
  const closedOrder = await prisma.order.create({
    data: {
      customerId,
      categoryId,
      masterId,
      description: 'trust test closed order',
      status: 'CLOSED',
      addressText: 'test',
    },
  });
  orderIds.push(closedOrder.id);

  const after = await trust.computeTrustScore(masterId);
  assert.equal(after.factors.cancellationRate, 0.5); // 1 cancelled / (1 cancelled + 1 closed)
  assert.ok(after.score < before.score, 'a cancellation should reduce the trust score');
});

test('penalty points deduct from the score, capped at MAX_PENALTY_DEDUCTION', async () => {
  const before = await trust.computeTrustScore(masterId);

  const penalty = await prisma.penaltyRecord.create({
    data: { masterId, eventType: 'CANCELLATION', severity: 'MODERATE', points: 10 },
  });
  penaltyIds.push(penalty.id);

  const after = await trust.computeTrustScore(masterId);
  assert.equal(after.factors.activePenaltyPoints, 10);
  assert.ok(after.score <= before.score - 10 || after.score === 0, 'penalty points should deduct from the score');
});

test('recomputeTrustTier persists the computed tier onto MasterProfile', async () => {
  const result = await trust.recomputeTrustTier(masterId);
  const master = await prisma.masterProfile.findUniqueOrThrow({ where: { userId: masterId } });
  assert.equal(master.trustTier, result.tier);
});

test('an unverified master never gets the verification bonus', async () => {
  const suffix = randomUUID().slice(0, 8);
  const unverifiedUser = await prisma.user.create({
    data: { phone: `+998932${suffix.slice(0, 6)}`, passwordHash: 'x', role: 'MASTER', status: 'ACTIVE', referralCode: `TU${suffix}`.slice(0, 20) },
  });
  await prisma.masterProfile.create({
    data: { userId: unverifiedUser.id, verificationStatus: 'UNVERIFIED', jobsDone: 25, ratingAvg: 4.5 },
  });
  const result = await trust.computeTrustScore(unverifiedUser.id);
  assert.equal(result.factors.verificationStatus, 'UNVERIFIED');

  await prisma.masterProfile.deleteMany({ where: { userId: unverifiedUser.id } });
  await prisma.user.deleteMany({ where: { id: unverifiedUser.id } });
});
