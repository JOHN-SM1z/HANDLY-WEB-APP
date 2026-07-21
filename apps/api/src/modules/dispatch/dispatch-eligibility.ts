import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../infra/prisma/prisma.service';

export interface EligibleCandidate {
  masterId: string;
  distanceM: number;
  ratingAvg: number;
  jobsDone: number;
}

export interface FindEligibleCandidatesParams {
  orderId: string;
  categoryId: string;
  requiredTier: number;
  /** Tashkent-local "today" (YYYY-MM-DD) — see contracts' tashkentTodayDateStr(). */
  todayDateStr: string;
  /** Multiplies each master's own ServiceArea.radiusM (1 normally, >1 on the one expanded retry). */
  radiusMultiplier: number;
  limit: number;
}

/**
 * §9.2.1 eligibility, as one indexed query (not N+1): category skill match ∧
 * order location within the master's own declared service-area radius
 * (widened by radiusMultiplier on retry) ∧ verified ∧ online ∧ trust tier ∧
 * active account ∧ not currently working an active job ∧ not busy/booked
 * today (existing AvailabilitySlot table) ∧ not already offered this order.
 * DISTINCT ON collapses masters with multiple matching service areas to
 * their closest one; the outer query then sorts all candidates by distance
 * and caps at `limit`.
 */
export async function findEligibleCandidates(
  prisma: PrismaService,
  params: FindEligibleCandidatesParams,
): Promise<EligibleCandidate[]> {
  const { orderId, categoryId, requiredTier, todayDateStr, radiusMultiplier, limit } = params;

  return prisma.$queryRaw<EligibleCandidate[]>(Prisma.sql`
    SELECT "masterId", "distanceM", "ratingAvg", "jobsDone"
    FROM (
      SELECT DISTINCT ON (mp."userId")
        mp."userId" AS "masterId",
        ST_Distance(sa."centerPoint", o."location")::int AS "distanceM",
        mp."ratingAvg"::float AS "ratingAvg",
        mp."jobsDone" AS "jobsDone"
      FROM master_profiles mp
      JOIN users u ON u.id = mp."userId" AND u.status = 'ACTIVE'
      JOIN master_skills ms ON ms."masterId" = mp."userId" AND ms."categoryId" = ${categoryId}::uuid
      JOIN service_areas sa ON sa."masterId" = mp."userId"
      CROSS JOIN orders o
      WHERE o.id = ${orderId}::uuid
        AND o."location" IS NOT NULL
        AND ST_DWithin(sa."centerPoint", o."location", sa."radiusM" * ${radiusMultiplier}::float)
        AND mp."verificationStatus" = 'VERIFIED'
        AND mp."isOnline" = true
        AND mp."trustTier" >= ${requiredTier}::int
        AND mp."userId" NOT IN (
          SELECT od."masterId" FROM order_dispatches od WHERE od."orderId" = ${orderId}::uuid
        )
        AND NOT EXISTS (
          SELECT 1 FROM orders busy
          WHERE busy."masterId" = mp."userId" AND busy.status = 'ASSIGNED'
        )
        AND NOT EXISTS (
          SELECT 1 FROM availability_slots av
          WHERE av."masterId" = mp."userId"
            AND av.day = ${todayDateStr}::date
            AND av.kind IN ('BUSY', 'BOOKED')
        )
      ORDER BY mp."userId", "distanceM" ASC
    ) candidates
    ORDER BY "distanceM" ASC
    LIMIT ${limit}::int
  `);
}
