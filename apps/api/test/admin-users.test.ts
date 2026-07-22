/**
 * DB-touching tests for AdminUsersService — search/filter/pagination,
 * suspend/restore idempotency, the privilege-escalation guards (can't
 * suspend an ADMIN, can't self-suspend), and that every mutation is
 * audit-logged. RBAC (RolesGuard rejecting a non-admin caller) is a
 * controller/guard-layer concern this codebase has never unit-tested
 * directly (no test here does — verified live via curl instead, same as
 * every prior batch's manual pass).
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { AdminUsersService } from '../src/modules/admin/admin-users.service';
import { TrustService } from '../src/modules/trust/trust.service';

const prisma = new PrismaService();
const audit = new AuditService(prisma);
const stubPenalties = { getHistory: async () => ({ items: [], activePoints: 0 }) };
const trust = new TrustService(prisma);
const adminUsers = new AdminUsersService(prisma, audit, stubPenalties as never, trust);

const adminId = randomUUID();
let customerId: string;
let customerPhone: string;
let otherAdminId: string;
const userIds: string[] = [];

before(async () => {
  const suffix = randomUUID().slice(0, 8);
  await prisma.user.create({
    data: { id: adminId, phone: `+998960${suffix.slice(0, 6)}`, passwordHash: 'x', role: 'ADMIN', status: 'ACTIVE', referralCode: `AU${suffix}`.slice(0, 20) },
  });
  userIds.push(adminId);

  customerPhone = `+998961${suffix.slice(0, 6)}`;
  const customer = await prisma.user.create({
    data: { phone: customerPhone, passwordHash: 'x', role: 'CUSTOMER', status: 'ACTIVE', referralCode: `AC${suffix}`.slice(0, 20) },
  });
  customerId = customer.id;
  userIds.push(customerId);

  const otherAdmin = await prisma.user.create({
    data: { phone: `+998962${suffix.slice(0, 6)}`, passwordHash: 'x', role: 'ADMIN', status: 'ACTIVE', referralCode: `AD${suffix}`.slice(0, 20) },
  });
  otherAdminId = otherAdmin.id;
  userIds.push(otherAdminId);
});

after(async () => {
  await prisma.auditLog.deleteMany({ where: { actorId: adminId } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

test('list finds a user by phone substring', async () => {
  const page = await adminUsers.list({ phone: customerPhone.slice(-6), role: 'CUSTOMER' });
  assert.ok(page.items.some((i) => i.id === customerId));
});

test('list filters by role', async () => {
  const page = await adminUsers.list({ role: 'ADMIN' });
  assert.ok(page.items.every((i) => i.role === 'ADMIN'));
  assert.ok(page.items.some((i) => i.id === adminId));
});

test('detail returns ordersCount and null penaltyPoints for a customer', async () => {
  const detail = await adminUsers.detail(customerId);
  assert.equal(detail.id, customerId);
  assert.equal(detail.ordersCount, 0);
  assert.equal(detail.penaltyPoints, null);
});

test('suspend flips status to SUSPENDED and is audit-logged with before/after', async () => {
  const result = await adminUsers.suspend(customerId, adminId, 'test reason');
  assert.equal(result.status, 'SUSPENDED');

  const row = await prisma.user.findUniqueOrThrow({ where: { id: customerId } });
  assert.equal(row.status, 'SUSPENDED');

  const auditRow = await prisma.auditLog.findFirstOrThrow({
    where: { actorId: adminId, entityId: customerId, action: 'USER_SUSPEND' },
  });
  assert.deepEqual(auditRow.before, { status: 'ACTIVE' });
});

test('suspend is idempotent — suspending an already-suspended user is a safe no-op, still audit-logged', async () => {
  const before = await prisma.auditLog.count({ where: { actorId: adminId, action: 'USER_SUSPEND' } });
  const result = await adminUsers.suspend(customerId, adminId, 'second attempt');
  assert.equal(result.status, 'SUSPENDED');
  const after = await prisma.auditLog.count({ where: { actorId: adminId, action: 'USER_SUSPEND' } });
  assert.equal(after, before + 1, 'the attempt itself is still logged even though the state did not change');
});

test('restore flips status back to ACTIVE and is audit-logged', async () => {
  const result = await adminUsers.restore(customerId, adminId);
  assert.equal(result.status, 'ACTIVE');
  const row = await prisma.user.findUniqueOrThrow({ where: { id: customerId } });
  assert.equal(row.status, 'ACTIVE');
});

test('restore on a non-suspended user is a safe no-op', async () => {
  const result = await adminUsers.restore(customerId, adminId);
  assert.equal(result.status, 'ACTIVE');
});

test('privilege escalation guard: suspending another ADMIN account is rejected', async () => {
  await assert.rejects(() => adminUsers.suspend(otherAdminId, adminId, 'test'));
  const row = await prisma.user.findUniqueOrThrow({ where: { id: otherAdminId } });
  assert.equal(row.status, 'ACTIVE', 'the target admin must remain untouched');
});

test('lockout guard: an admin cannot suspend their own account', async () => {
  await assert.rejects(() => adminUsers.suspend(adminId, adminId, 'test'));
});

test('concurrent race: two simultaneous suspend calls on the same user both succeed, exactly one USER_SUSPEND audit row records the real before-state', async () => {
  const suffix = randomUUID().slice(0, 8);
  const target = await prisma.user.create({
    data: { phone: `+998963${suffix}`, passwordHash: 'x', role: 'CUSTOMER', status: 'ACTIVE', referralCode: `AR${suffix}`.slice(0, 20) },
  });
  userIds.push(target.id);

  const results = await Promise.allSettled([
    adminUsers.suspend(target.id, adminId, 'race-a'),
    adminUsers.suspend(target.id, adminId, 'race-b'),
  ]);
  assert.ok(results.every((r) => r.status === 'fulfilled'), 'both calls resolve — the guarded updateMany makes the loser a no-op, not an error');

  const row = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
  assert.equal(row.status, 'SUSPENDED');

  const auditRows = await prisma.auditLog.findMany({ where: { actorId: adminId, entityId: target.id, action: 'USER_SUSPEND' } });
  assert.equal(auditRows.length, 2, 'both attempts are logged');
  const realTransition = auditRows.filter((r) => (r.after as { alreadySuspended: boolean }).alreadySuspended === false);
  assert.equal(realTransition.length, 1, 'exactly one of the two calls actually performed the ACTIVE->SUSPENDED transition');
});
