/**
 * DB-touching tests for FeatureFlagsService — CRUD, idempotent upsert, and
 * that every upsert is audit-logged (Batch 3's "configuration foundation").
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { FeatureFlagsService } from '../src/modules/feature-flags/feature-flags.service';

const prisma = new PrismaService();
const audit = new AuditService(prisma);
const flags = new FeatureFlagsService(prisma, audit);

const adminId = randomUUID();
const key = `test_flag_${randomUUID().slice(0, 8)}`;

after(async () => {
  await prisma.featureFlag.deleteMany({ where: { key } });
  await prisma.auditLog.deleteMany({ where: { actorId: adminId } });
  await prisma.$disconnect();
});

test('upsert creates a new flag and audit-logs it as a create', async () => {
  const flag = await flags.upsert(adminId, key, true, 'test description');
  assert.equal(flag.key, key);
  assert.equal(flag.enabled, true);
  assert.equal(flag.description, 'test description');

  const auditRow = await prisma.auditLog.findFirstOrThrow({ where: { actorId: adminId, entityId: key } });
  assert.equal(auditRow.action, 'FEATURE_FLAG_CREATE');
  assert.equal(auditRow.before, null);
});

test('upsert on an existing key updates it and audit-logs it as an update, with before captured', async () => {
  const updated = await flags.upsert(adminId, key, false, 'changed');
  assert.equal(updated.enabled, false);
  assert.equal(updated.description, 'changed');

  const auditRow = await prisma.auditLog.findFirstOrThrow({
    where: { actorId: adminId, entityId: key, action: 'FEATURE_FLAG_UPDATE' },
  });
  const before = auditRow.before as { enabled: boolean; description: string | null };
  assert.equal(before.enabled, true, 'before-state should reflect the flag as it was prior to this update');
  assert.equal(before.description, 'test description');
});

test('upsert is idempotent — calling with the same values twice yields the same state', async () => {
  await flags.upsert(adminId, key, false, 'changed');
  const list = await flags.list();
  const matches = list.filter((f) => f.key === key);
  assert.equal(matches.length, 1, 'no duplicate rows from a repeated upsert');
  assert.equal(matches[0]!.enabled, false);
});

test('list returns flags ordered by key', async () => {
  const list = await flags.list();
  const keys = list.map((f) => f.key);
  const sorted = [...keys].sort();
  assert.deepEqual(keys, sorted);
});
