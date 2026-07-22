/**
 * DB-touching tests for AuditService — the append-only record/list surface
 * every admin mutation in Batch 3 writes through.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';

const prisma = new PrismaService();
const audit = new AuditService(prisma);

const actorId = randomUUID();
const entityId = randomUUID();

after(async () => {
  await prisma.auditLog.deleteMany({ where: { actorId } });
  await prisma.$disconnect();
});

test('record writes an append-only entry with before/after captured', async () => {
  await audit.record(actorId, 'TEST_ACTION', 'TestEntity', entityId, { status: 'OLD' }, { status: 'NEW' });
  const row = await prisma.auditLog.findFirstOrThrow({ where: { actorId, action: 'TEST_ACTION' } });
  assert.equal(row.entityType, 'TestEntity');
  assert.equal(row.entityId, entityId);
  assert.deepEqual(row.before, { status: 'OLD' });
  assert.deepEqual(row.after, { status: 'NEW' });
});

test('record works with no before/after (e.g. a create with nothing to diff)', async () => {
  await audit.record(actorId, 'TEST_CREATE', 'TestEntity', entityId);
  const row = await prisma.auditLog.findFirstOrThrow({ where: { actorId, action: 'TEST_CREATE' } });
  assert.equal(row.before, null);
  assert.equal(row.after, null);
});

test('list returns entries newest-first, filterable by actorId', async () => {
  const page = await audit.list(undefined, actorId);
  assert.ok(page.items.length >= 2);
  assert.ok(page.items.every((i) => i.actorId === actorId));
  const timestamps = page.items.map((i) => new Date(i.createdAt).getTime());
  const sorted = [...timestamps].sort((a, b) => b - a);
  assert.deepEqual(timestamps, sorted);
});

test('list filters by entityType', async () => {
  await audit.record(actorId, 'OTHER_ACTION', 'OtherEntity', randomUUID());
  const page = await audit.list(undefined, actorId, 'OtherEntity');
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0]!.entityType, 'OtherEntity');
});
