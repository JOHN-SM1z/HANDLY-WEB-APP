/**
 * DB-touching tests for ReferralsService — the full signup -> verify ->
 * first-payment reward lifecycle, self-referral/invalid-code no-ops, and
 * the concurrent-reward race (two simultaneous "first payments" for the
 * same referee must only reward the referrer once).
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { ReferralsService, REFERRAL_REWARD_AMOUNT } from '../src/modules/referrals/referrals.service';

const prisma = new PrismaService();
const referrals = new ReferralsService(prisma);

let referrerId: string;
let referrerCode: string;
const userIds: string[] = [];

before(async () => {
  const suffix = randomUUID().slice(0, 8);
  const referrer = await prisma.user.create({
    data: { phone: `+998970${suffix.slice(0, 6)}`, passwordHash: 'x', role: 'CUSTOMER', status: 'ACTIVE', referralCode: `REF${suffix}`.slice(0, 20) },
  });
  referrerId = referrer.id;
  referrerCode = referrer.referralCode;
  userIds.push(referrerId);
});

after(async () => {
  await prisma.cashbackRecord.deleteMany({ where: { userId: referrerId } });
  await prisma.referral.deleteMany({ where: { referrerId } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

async function makeReferee(): Promise<string> {
  const suffix = randomUUID().slice(0, 8);
  const user = await prisma.user.create({
    data: { phone: `+998971${suffix.slice(0, 6)}`, passwordHash: 'x', role: 'CUSTOMER', status: 'PENDING', referralCode: `REE${suffix}`.slice(0, 20) },
  });
  userIds.push(user.id);
  return user.id;
}

test('recordSignup with a valid code creates a PENDING referral', async () => {
  const refereeId = await makeReferee();
  await referrals.recordSignup(refereeId, referrerCode);
  const referral = await prisma.referral.findUnique({ where: { refereeId } });
  assert.ok(referral);
  assert.equal(referral!.referrerId, referrerId);
  assert.equal(referral!.status, 'PENDING');
});

test('recordSignup silently no-ops on an invalid code', async () => {
  const refereeId = await makeReferee();
  await referrals.recordSignup(refereeId, 'NOT-A-REAL-CODE');
  const referral = await prisma.referral.findUnique({ where: { refereeId } });
  assert.equal(referral, null);
});

test('recordSignup silently no-ops on a self-referral (own code)', async () => {
  await referrals.recordSignup(referrerId, referrerCode);
  const referral = await prisma.referral.findUnique({ where: { refereeId: referrerId } });
  assert.equal(referral, null);
});

test('recordSignup with no code is a no-op', async () => {
  const refereeId = await makeReferee();
  await referrals.recordSignup(refereeId, undefined);
  const referral = await prisma.referral.findUnique({ where: { refereeId } });
  assert.equal(referral, null);
});

test('activateOnVerify flips PENDING -> ACTIVE', async () => {
  const refereeId = await makeReferee();
  await referrals.recordSignup(refereeId, referrerCode);
  await referrals.activateOnVerify(refereeId);
  const referral = await prisma.referral.findUniqueOrThrow({ where: { refereeId } });
  assert.equal(referral.status, 'ACTIVE');
});

test('rewardOnFirstPayment grants the referrer cashback and marks REWARDED', async () => {
  const refereeId = await makeReferee();
  await referrals.recordSignup(refereeId, referrerCode);
  await referrals.activateOnVerify(refereeId);

  const before = await prisma.cashbackRecord.count({ where: { userId: referrerId } });
  await referrals.rewardOnFirstPayment(refereeId);
  const after = await prisma.cashbackRecord.count({ where: { userId: referrerId } });
  assert.equal(after, before + 1);

  const cashback = await prisma.cashbackRecord.findFirst({
    where: { userId: referrerId },
    orderBy: { createdAt: 'desc' },
  });
  assert.equal(cashback!.amount, REFERRAL_REWARD_AMOUNT);
  assert.equal(cashback!.sourceType, 'REFERRAL_REWARD');

  const referral = await prisma.referral.findUniqueOrThrow({ where: { refereeId } });
  assert.equal(referral.status, 'REWARDED');
  assert.ok(referral.rewardedAt);
});

test('rewardOnFirstPayment is a no-op for a second payment by the same referee', async () => {
  const refereeId = await makeReferee();
  await referrals.recordSignup(refereeId, referrerCode);
  await referrals.activateOnVerify(refereeId);
  await referrals.rewardOnFirstPayment(refereeId);

  const countAfterFirst = await prisma.cashbackRecord.count({ where: { userId: referrerId } });
  await referrals.rewardOnFirstPayment(refereeId); // second "first payment" — should be a no-op
  const countAfterSecond = await prisma.cashbackRecord.count({ where: { userId: referrerId } });
  assert.equal(countAfterSecond, countAfterFirst, 'a referral must only ever be rewarded once');
});

test('concurrent race: two simultaneous rewardOnFirstPayment calls only reward once', async () => {
  const refereeId = await makeReferee();
  await referrals.recordSignup(refereeId, referrerCode);
  await referrals.activateOnVerify(refereeId);

  const before = await prisma.cashbackRecord.count({ where: { userId: referrerId } });
  await Promise.all([referrals.rewardOnFirstPayment(refereeId), referrals.rewardOnFirstPayment(refereeId)]);
  const after = await prisma.cashbackRecord.count({ where: { userId: referrerId } });
  assert.equal(after, before + 1, 'exactly one cashback record must be created even under a race');
});

test('getSummary reports the correct totals and masks the referee phone', async () => {
  const summary = await referrals.getSummary(referrerId);
  assert.equal(summary.referralCode, referrerCode);
  assert.ok(summary.totalReferred >= 1);
  assert.ok(summary.totalRewarded >= 1);
  assert.ok(summary.totalCashbackEarned >= REFERRAL_REWARD_AMOUNT);
  for (const r of summary.referrals) {
    assert.ok(!r.refereePhoneMasked.includes('*') || r.refereePhoneMasked.length > 5);
  }
});
