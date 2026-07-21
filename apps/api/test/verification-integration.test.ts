/**
 * DB-touching tests for VerificationService — the submit -> approve/reject
 * lifecycle on the existing Verification model, duplicate-pending guard,
 * and MasterProfile.verificationStatus staying in sync throughout.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { VerificationService } from '../src/modules/verification/verification.service';

const prisma = new PrismaService();
const stubNotifications = { notify: async () => {} };
const verification = new VerificationService(prisma, stubNotifications as never);
const fakeAdminId = randomUUID();

let masterId: string;
const userIds: string[] = [];

before(async () => {
  const suffix = randomUUID().slice(0, 8);
  const master = await prisma.user.create({
    data: { phone: `+998990${suffix.slice(0, 6)}`, passwordHash: 'x', role: 'MASTER', status: 'ACTIVE', referralCode: `VM${suffix}`.slice(0, 20) },
  });
  masterId = master.id;
  userIds.push(masterId);
  await prisma.masterProfile.create({ data: { userId: masterId, verificationStatus: 'UNVERIFIED' } });
});

after(async () => {
  await prisma.verification.deleteMany({ where: { masterId } });
  await prisma.masterProfile.deleteMany({ where: { userId: masterId } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

test('submit creates a PENDING verification and flips MasterProfile.verificationStatus to PENDING', async () => {
  const record = await verification.submit(masterId, "Guvohnoma biriktirilgan");
  assert.equal(record.status, 'PENDING');
  const master = await prisma.masterProfile.findUniqueOrThrow({ where: { userId: masterId } });
  assert.equal(master.verificationStatus, 'PENDING');
});

test('a second submit while one is already PENDING is rejected', async () => {
  await assert.rejects(() => verification.submit(masterId, 'ikkinchi urinish'));
});

test('decide(approve=true) transitions to VERIFIED and syncs MasterProfile', async () => {
  const latest = await verification.getMyLatest(masterId);
  const decided = await verification.decide(latest!.id, fakeAdminId, true);
  assert.equal(decided.status, 'VERIFIED');
  const master = await prisma.masterProfile.findUniqueOrThrow({ where: { userId: masterId } });
  assert.equal(master.verificationStatus, 'VERIFIED');
});

test('cannot resubmit once already VERIFIED', async () => {
  await assert.rejects(() => verification.submit(masterId, 'yana bir urinish'));
});

test('a PENDING/VERIFIED verification cannot be decided twice', async () => {
  const latest = await verification.getMyLatest(masterId);
  await assert.rejects(() => verification.decide(latest!.id, fakeAdminId, true));
});

test('decide(approve=false) requires a note and transitions to REJECTED', async () => {
  // Reset to UNVERIFIED and submit fresh for this test.
  await prisma.masterProfile.update({ where: { userId: masterId }, data: { verificationStatus: 'UNVERIFIED' } });
  const record = await verification.submit(masterId);

  await assert.rejects(() => verification.decide(record.id, fakeAdminId, false)); // no note -> rejected by validation

  const decided = await verification.decide(record.id, fakeAdminId, false, "Hujjatlar noaniq");
  assert.equal(decided.status, 'REJECTED');
  const master = await prisma.masterProfile.findUniqueOrThrow({ where: { userId: masterId } });
  assert.equal(master.verificationStatus, 'REJECTED');
});

test('a master can resubmit after a rejection', async () => {
  const record = await verification.submit(masterId, 'qayta yuborildi');
  assert.equal(record.status, 'PENDING');
});
