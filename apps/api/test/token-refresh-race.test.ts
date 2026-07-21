/**
 * DB-touching correctness test for TokenService.consumeSession's race safety
 * — the same class of test as dispatch-integration.test.ts's accept-race,
 * applied to refresh-token rotation. Runs against the real dev Postgres
 * (same as the app does at runtime) since it's Postgres's actual FOR UPDATE
 * lock semantics being verified, not something a mock could prove.
 *
 * Requires DATABASE_URL (loaded via the root .env, same as every other script).
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createHash, randomBytes } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { AppConfig } from '../src/infra/config/app-config';
import { loadEnv } from '../src/infra/config/env';
import { TokenService } from '../src/modules/auth/token.service';

const prisma = new PrismaService();
const config = new AppConfig(loadEnv());
const token = new TokenService(new JwtService({ secret: config.env.JWT_ACCESS_SECRET }), prisma, config);

let userId: string;
const rawRefresh = randomBytes(48).toString('base64url');
const refreshTokenHash = createHash('sha256').update(rawRefresh).digest('hex');
let sessionId: string;

before(async () => {
  const suffix = randomUUID().slice(0, 8);
  const user = await prisma.user.create({
    data: {
      phone: `+998902${suffix.slice(0, 6)}`,
      passwordHash: 'x',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      referralCode: `TESTR${suffix}`.slice(0, 20),
    },
  });
  userId = user.id;

  const session = await prisma.session.create({
    data: {
      userId,
      refreshTokenHash,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  sessionId = session.id;
});

after(async () => {
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

test('consumeSession race: exactly one of two concurrent refreshes of the same raw token succeeds', async () => {
  const results = await Promise.allSettled([
    token.consumeSession(rawRefresh),
    token.consumeSession(rawRefresh),
  ]);
  const succeeded = results.filter((r) => r.status === 'fulfilled');
  const failed = results.filter((r) => r.status === 'rejected');
  assert.equal(succeeded.length, 1, 'exactly one concurrent refresh should succeed');
  assert.equal(failed.length, 1, 'exactly one concurrent refresh should be rejected');

  const winner = succeeded[0] as PromiseFulfilledResult<{ id: string; userId: string }>;
  assert.equal(winner.value.id, sessionId);

  const finalSession = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
  assert.ok(finalSession.revokedAt !== null, 'the session must end up revoked exactly once');
});

test('consumeSession is single-use: a third call on the now-revoked token is rejected', async () => {
  await assert.rejects(() => token.consumeSession(rawRefresh));
});
