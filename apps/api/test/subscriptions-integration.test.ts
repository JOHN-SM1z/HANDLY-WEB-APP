/**
 * DB-touching tests for SubscriptionsService — the implicit Free default,
 * the no-billing Premium trial upgrade, the already-Premium conflict guard,
 * and the lazy trial-expiry self-heal (no cron).
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { SubscriptionsService } from '../src/modules/subscriptions/subscriptions.service';

const prisma = new PrismaService();
const subscriptions = new SubscriptionsService(prisma);

let masterId: string;
const userIds: string[] = [];

before(async () => {
  const suffix = randomUUID().slice(0, 8);
  const master = await prisma.user.create({
    data: { phone: `+998980${suffix.slice(0, 6)}`, passwordHash: 'x', role: 'MASTER', status: 'ACTIVE', referralCode: `SM${suffix}`.slice(0, 20) },
  });
  masterId = master.id;
  userIds.push(masterId);
  await prisma.masterProfile.create({ data: { userId: masterId, verificationStatus: 'VERIFIED' } });
});

after(async () => {
  await prisma.masterSubscription.deleteMany({ where: { masterId } });
  await prisma.masterProfile.deleteMany({ where: { userId: masterId } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

test('a master with no subscription row defaults to FREE/ACTIVE, not Premium', async () => {
  const status = await subscriptions.getStatus(masterId);
  assert.equal(status.plan, 'FREE');
  assert.equal(status.status, 'ACTIVE');
  assert.equal(status.isPremiumActive, false);
});

test('upgradeToPremium starts a 14-day trial with no billing/payment involved', async () => {
  const status = await subscriptions.upgradeToPremium(masterId);
  assert.equal(status.plan, 'PREMIUM');
  assert.equal(status.status, 'TRIAL');
  assert.ok(status.isPremiumActive);
  assert.ok(status.trialEndsAt);
  const daysUntilTrialEnd = (new Date(status.trialEndsAt!).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
  assert.ok(daysUntilTrialEnd > 13 && daysUntilTrialEnd < 15);
});

test('upgrading again while already Premium is rejected', async () => {
  await assert.rejects(() => subscriptions.upgradeToPremium(masterId));
});

test('isPremiumActive matches getStatus().isPremiumActive', async () => {
  const active = await subscriptions.isPremiumActive(masterId);
  assert.equal(active, true);
});

test('an expired trial self-heals to EXPIRED on read (no cron) and is no longer premium-active', async () => {
  await prisma.masterSubscription.update({
    where: { masterId },
    data: { trialEndsAt: new Date(Date.now() - 1000) }, // already expired
  });
  const status = await subscriptions.getStatus(masterId);
  assert.equal(status.status, 'EXPIRED');
  assert.equal(status.isPremiumActive, false);

  const row = await prisma.masterSubscription.findUniqueOrThrow({ where: { masterId } });
  assert.equal(row.status, 'EXPIRED', 'the self-heal should have persisted, not just returned in the DTO');
});

test('after expiry, upgrading to Premium again is allowed', async () => {
  const status = await subscriptions.upgradeToPremium(masterId);
  assert.equal(status.status, 'TRIAL');
  assert.ok(status.isPremiumActive);
});
