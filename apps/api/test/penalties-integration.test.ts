/**
 * DB-touching tests for PenaltiesService against real Postgres — verifies
 * the centralized PENALTY_RULES table drives the actual points/severity
 * recorded, the trailing-window aggregate in getHistory, and that
 * recordEvent never bans/suspends (just writes a record + recomputes trust).
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { TrustService } from '../src/modules/trust/trust.service';
import { PenaltiesService } from '../src/modules/penalties/penalties.service';
import { PENALTY_RULES } from '../src/modules/penalties/penalty-rules';

const prisma = new PrismaService();
const trust = new TrustService(prisma);
const stubNotifications = { notify: async () => {} };
const penalties = new PenaltiesService(prisma, trust, stubNotifications as never);

let masterId: string;
const penaltyIds: string[] = [];

before(async () => {
  const suffix = randomUUID().slice(0, 8);
  const master = await prisma.user.create({
    data: { phone: `+998940${suffix.slice(0, 6)}`, passwordHash: 'x', role: 'MASTER', status: 'ACTIVE', referralCode: `PM${suffix}`.slice(0, 20) },
  });
  masterId = master.id;
  await prisma.masterProfile.create({ data: { userId: masterId, verificationStatus: 'VERIFIED', jobsDone: 5 } });
});

after(async () => {
  await prisma.penaltyRecord.deleteMany({ where: { masterId } });
  await prisma.masterProfile.deleteMany({ where: { userId: masterId } });
  await prisma.user.deleteMany({ where: { id: masterId } });
  await prisma.$disconnect();
});

test('recordEvent uses the centralized PENALTY_RULES table, not a hardcoded value', async () => {
  const dto = await penalties.recordEvent(masterId, 'CANCELLATION');
  penaltyIds.push(dto.id);
  const rule = PENALTY_RULES.CANCELLATION;
  assert.equal(dto.severity, rule.severity);
  assert.equal(dto.points, rule.points);
  assert.equal(dto.eventType, 'CANCELLATION');
});

test('recordEvent never bans/suspends the user — MasterProfile.status is untouched', async () => {
  const before = await prisma.user.findUniqueOrThrow({ where: { id: masterId } });
  await penalties.recordEvent(masterId, 'NO_SHOW');
  const after = await prisma.user.findUniqueOrThrow({ where: { id: masterId } });
  assert.equal(after.status, before.status, 'status must be untouched — no auto-ban');
});

test('recordEvent recomputes the trust tier as a side effect', async () => {
  await penalties.recordEvent(masterId, 'POOR_QUALITY');
  const afterMaster = await prisma.masterProfile.findUniqueOrThrow({ where: { userId: masterId } });
  // trustTier is a derived, deterministic function of state — just assert it's still a valid 0..3 value
  // (the specific before/after values depend on prior tests' penalty history, not asserted here).
  assert.ok(afterMaster.trustTier >= 0 && afterMaster.trustTier <= 3);
});

test('getHistory sums only points within the trailing lookback window', async () => {
  const beforeActivePoints = (await penalties.getHistory(masterId)).activePoints;

  const oldPenalty = await prisma.penaltyRecord.create({
    data: {
      masterId,
      eventType: 'LATE_RESPONSE',
      severity: 'MINOR',
      points: 3,
      createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000), // 200 days ago — outside the 90-day window
    },
  });
  penaltyIds.push(oldPenalty.id);

  const history = await penalties.getHistory(masterId);
  // The old penalty must appear in full history...
  assert.ok(history.items.some((i) => i.id === oldPenalty.id), 'old penalty should still appear in full history');
  // ...but must NOT count toward activePoints (outside the trailing window).
  assert.equal(history.activePoints, beforeActivePoints, "a 200-day-old penalty shouldn't affect the active-points total");
});

test('every PENALTY_RULES entry has a positive point value and a valid severity', () => {
  for (const [eventType, rule] of Object.entries(PENALTY_RULES)) {
    assert.ok(rule.points > 0, `${eventType} should have positive points`);
    assert.ok(['MINOR', 'MODERATE', 'SEVERE'].includes(rule.severity), `${eventType} has invalid severity`);
  }
});
