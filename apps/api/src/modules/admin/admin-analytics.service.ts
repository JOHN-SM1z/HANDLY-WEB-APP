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
      activeMasterIds,
      activeCustomerIds,
      revenueAgg,
      avgResponseRow,
      avgCompletionRow,
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

    return {
      ordersCreated,
      ordersCompleted,
      ordersCancelled,
      activeMasters: activeMasterIds.length,
      activeCustomers: activeCustomerIds.length,
      revenueTotal: revenueAgg._sum.amount ?? 0,
      avgResponseTimeSeconds: avgResponseRow[0]?.avgSeconds ?? null,
      avgCompletionTimeSeconds: avgCompletionRow[0]?.avgSeconds ?? null,
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
