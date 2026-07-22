import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AdminAnalyticsOverviewDto } from '@handly/contracts';
import { PrismaService } from '../../infra/prisma/prisma.service';

interface Range {
  dateFrom?: string;
  dateTo?: string;
}

/**
 * All "in range" metrics below (orders, revenue, response/completion time,
 * satisfaction, cashback) are real event counts/aggregates over `createdAt`/
 * `succeededAt`/etc. within the given window — never fabricated. Verification
 * and subscription and referral stats are current-state snapshots (how many
 * masters/referrals sit in each status right now), not date-scoped, since
 * "how many are VERIFIED today" is the more useful ops question than "how
 * many became VERIFIED this week" for a foundation-level overview.
 */
@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(range: Range): Promise<AdminAnalyticsOverviewDto> {
    const createdAtWhere = this.dateRangeWhere(range);

    const [
      ordersCreated,
      ordersCompleted,
      ordersCancelled,
      ordersExpired,
      activeMasterIds,
      activeCustomerIds,
      mastersOnlineNow,
      revenueAgg,
      avgResponseRow,
      avgCompletionRow,
      avgAssignmentRow,
      assignedCount,
      satisfactionAgg,
      verificationGroups,
      subscriptionRows,
      cashbackAgg,
      referralGroups,
    ] = await Promise.all([
      this.prisma.order.count({ where: { createdAt: createdAtWhere } }),
      this.prisma.order.count({ where: { status: 'CLOSED', createdAt: createdAtWhere } }),
      this.prisma.order.count({
        where: { status: { in: ['CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_MASTER'] }, createdAt: createdAtWhere },
      }),
      // Beta Blocker Sprint — pool-exhausted orders in range (a real, terminal
      // status, so a direct count is consistent with ordersCompleted/Cancelled
      // above rather than needing the status-history join match-rate uses).
      this.prisma.order.count({ where: { status: 'EXPIRED', createdAt: createdAtWhere } }),
      this.prisma.order.findMany({
        where: { masterId: { not: null }, createdAt: createdAtWhere },
        distinct: ['masterId'],
        select: { masterId: true },
      }),
      this.prisma.order.findMany({
        where: { createdAt: createdAtWhere },
        distinct: ['customerId'],
        select: { customerId: true },
      }),
      // Beta Blocker Sprint — real-time snapshot (not date-scoped), same
      // convention as verificationStats/subscriptionStats below: "how many
      // masters are online right now" is the useful ops question, not
      // "how many went online this week."
      this.prisma.masterProfile.count({ where: { isOnline: true } }),
      this.prisma.payment.aggregate({
        where: { status: 'SUCCEEDED', succeededAt: this.dateRangeWhere(range, true) },
        _sum: { amount: true },
      }),
      this.prisma.$queryRaw<Array<{ avgSeconds: number | null }>>(Prisma.sql`
        SELECT AVG(EXTRACT(EPOCH FROM "respondedAt" - "offeredAt"))::float AS "avgSeconds"
        FROM order_dispatches
        WHERE "respondedAt" IS NOT NULL
          ${range.dateFrom ? Prisma.sql`AND "offeredAt" >= ${new Date(range.dateFrom)}` : Prisma.empty}
          ${range.dateTo ? Prisma.sql`AND "offeredAt" <= ${new Date(range.dateTo)}` : Prisma.empty}
      `),
      this.prisma.$queryRaw<Array<{ avgSeconds: number | null }>>(Prisma.sql`
        SELECT AVG(EXTRACT(EPOCH FROM h."createdAt" - o."createdAt"))::float AS "avgSeconds"
        FROM order_status_history h
        JOIN orders o ON o.id = h."orderId"
        WHERE h."toStatus" = 'COMPLETED'
          ${range.dateFrom ? Prisma.sql`AND h."createdAt" >= ${new Date(range.dateFrom)}` : Prisma.empty}
          ${range.dateTo ? Prisma.sql`AND h."createdAt" <= ${new Date(range.dateTo)}` : Prisma.empty}
      `),
      // Beta Blocker Sprint — order created → first reached ASSIGNED. Uses
      // order_status_history (not Order.status directly) for the same reason
      // avgCompletionTimeSeconds above does: an order can move well past
      // ASSIGNED by the time this query runs, so only the history row
      // reliably captures "when did this order first get matched."
      this.prisma.$queryRaw<Array<{ avgSeconds: number | null }>>(Prisma.sql`
        SELECT AVG(EXTRACT(EPOCH FROM h."createdAt" - o."createdAt"))::float AS "avgSeconds"
        FROM order_status_history h
        JOIN orders o ON o.id = h."orderId"
        WHERE h."toStatus" = 'ASSIGNED'
          ${range.dateFrom ? Prisma.sql`AND h."createdAt" >= ${new Date(range.dateFrom)}` : Prisma.empty}
          ${range.dateTo ? Prisma.sql`AND h."createdAt" <= ${new Date(range.dateTo)}` : Prisma.empty}
      `),
      // Beta Blocker Sprint — distinct orders that ever reached ASSIGNED in
      // range, for matchSuccessRate's numerator (same "ever reached" logic
      // as the timing query above, just counting rather than averaging).
      this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT COUNT(DISTINCT h."orderId")::bigint AS count
        FROM order_status_history h
        WHERE h."toStatus" = 'ASSIGNED'
          ${range.dateFrom ? Prisma.sql`AND h."createdAt" >= ${new Date(range.dateFrom)}` : Prisma.empty}
          ${range.dateTo ? Prisma.sql`AND h."createdAt" <= ${new Date(range.dateTo)}` : Prisma.empty}
      `),
      this.prisma.review.aggregate({ where: { createdAt: createdAtWhere }, _avg: { rating: true } }),
      this.prisma.masterProfile.groupBy({ by: ['verificationStatus'], _count: true }),
      this.prisma.masterSubscription.findMany({ select: { plan: true, status: true } }),
      this.prisma.cashbackRecord.aggregate({
        where: { createdAt: createdAtWhere },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.referral.groupBy({ by: ['status'], _count: true }),
    ]);

    const totalMasters = await this.prisma.masterProfile.count();
    const premiumCount = subscriptionRows.length; // only PREMIUM rows are ever created — see SubscriptionsService.
    const ordersAssigned = Number(assignedCount[0]?.count ?? 0n);
    const matchDenominator = ordersAssigned + ordersExpired;

    return {
      ordersCreated,
      ordersCompleted,
      ordersCancelled,
      ordersExpired,
      activeMasters: activeMasterIds.length,
      activeCustomers: activeCustomerIds.length,
      mastersOnlineNow,
      revenueTotal: revenueAgg._sum.amount ?? 0,
      avgResponseTimeSeconds: avgResponseRow[0]?.avgSeconds ?? null,
      avgCompletionTimeSeconds: avgCompletionRow[0]?.avgSeconds ?? null,
      avgAssignmentTimeSeconds: avgAssignmentRow[0]?.avgSeconds ?? null,
      matchSuccessRate: matchDenominator > 0 ? ordersAssigned / matchDenominator : null,
      customerSatisfactionAvg: satisfactionAgg._avg.rating ?? null,
      verificationStats: {
        unverified: this.countFor(verificationGroups, 'UNVERIFIED'),
        pending: this.countFor(verificationGroups, 'PENDING'),
        verified: this.countFor(verificationGroups, 'VERIFIED'),
        rejected: this.countFor(verificationGroups, 'REJECTED'),
      },
      subscriptionStats: {
        free: totalMasters - premiumCount,
        premium: premiumCount,
        trial: subscriptionRows.filter((r) => r.status === 'TRIAL').length,
      },
      cashbackStats: {
        totalAmount: cashbackAgg._sum.amount ?? 0,
        recordCount: cashbackAgg._count,
      },
      referralStats: {
        pending: this.countForReferral(referralGroups, 'PENDING'),
        active: this.countForReferral(referralGroups, 'ACTIVE'),
        rewarded: this.countForReferral(referralGroups, 'REWARDED'),
      },
    };
  }

  private dateRangeWhere(range: Range, required = false): Prisma.DateTimeFilter | undefined {
    if (!range.dateFrom && !range.dateTo) return required ? undefined : undefined;
    return {
      ...(range.dateFrom ? { gte: new Date(range.dateFrom) } : {}),
      ...(range.dateTo ? { lte: new Date(range.dateTo) } : {}),
    };
  }

  private countFor(groups: Array<{ verificationStatus: string; _count: number }>, status: string): number {
    return groups.find((g) => g.verificationStatus === status)?._count ?? 0;
  }

  private countForReferral(groups: Array<{ status: string; _count: number }>, status: string): number {
    return groups.find((g) => g.status === status)?._count ?? 0;
  }
}
