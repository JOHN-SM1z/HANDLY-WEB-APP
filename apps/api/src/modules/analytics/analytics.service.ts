import { Injectable, NotFoundException } from '@nestjs/common';
import type { MasterAnalyticsDto } from '@handly/contracts';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { ReviewsService } from '../reviews/reviews.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TrustService } from '../trust/trust.service';

const RECENT_REVIEWS_FOR_TREND = 10;

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trust: TrustService,
    private readonly reviews: ReviewsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly payments: PaymentsService,
  ) {}

  /** Real-data-only master analytics (Batch 2) — no fake/demo values anywhere in this DTO. */
  async getForMaster(masterId: string): Promise<MasterAnalyticsDto> {
    const master = await this.prisma.masterProfile.findUnique({ where: { userId: masterId } });
    if (!master) throw new NotFoundException('Usta profili topilmadi');

    const [trustScore, recentReviews, subscription, earningsPage] = await Promise.all([
      this.trust.computeTrustScore(masterId),
      this.reviews.getRecentForMaster(masterId, RECENT_REVIEWS_FOR_TREND),
      this.subscriptions.getStatus(masterId),
      this.payments.getMasterEarnings(masterId),
    ]);

    const ratingAvg = Number(master.ratingAvg);
    const recentAvg =
      recentReviews.length > 0
        ? recentReviews.reduce((sum, r) => sum + r.rating, 0) / recentReviews.length
        : ratingAvg;

    return {
      jobsDone: master.jobsDone,
      ratingAvg,
      ratingTrendDelta: Math.round((recentAvg - ratingAvg) * 100) / 100,
      responseRate: trustScore.factors.responseRate,
      trustScore: trustScore.score,
      trustTier: trustScore.tier,
      subscriptionPlan: subscription.plan,
      earnings: earningsPage.summary,
    };
  }
}
