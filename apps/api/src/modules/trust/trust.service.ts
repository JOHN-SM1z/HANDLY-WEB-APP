import { Injectable, NotFoundException } from '@nestjs/common';
import type { TrustScoreDto } from '@handly/contracts';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  JOBS_DONE_CAP,
  MAX_PENALTY_DEDUCTION,
  PENALTY_LOOKBACK_DAYS,
  scoreToTier,
  TRUST_WEIGHTS,
} from './trust-config';

@Injectable()
export class TrustService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pure(ish) calculation — reads current DB state, computes a deterministic
   * 0..100 score and 0..3 tier, does NOT write anything. See recomputeTrustTier
   * for the version that also persists the tier.
   */
  async computeTrustScore(masterId: string): Promise<TrustScoreDto> {
    const master = await this.prisma.masterProfile.findUnique({ where: { userId: masterId } });
    if (!master) throw new NotFoundException('Usta profili topilmadi');

    const [cancelled, closed, accepted, declinedOrExpired, penaltyAgg] = await Promise.all([
      this.prisma.order.count({ where: { masterId, status: 'CANCELLED_BY_MASTER' } }),
      this.prisma.order.count({ where: { masterId, status: 'CLOSED' } }),
      this.prisma.orderDispatch.count({ where: { masterId, status: 'ACCEPTED' } }),
      this.prisma.orderDispatch.count({ where: { masterId, status: { in: ['DECLINED', 'EXPIRED'] } } }),
      this.prisma.penaltyRecord.aggregate({
        where: {
          masterId,
          createdAt: { gte: new Date(Date.now() - PENALTY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000) },
        },
        _sum: { points: true },
      }),
    ]);

    const cancellationDenominator = cancelled + closed;
    const cancellationRate = cancellationDenominator > 0 ? cancelled / cancellationDenominator : 0;

    const responseDenominator = accepted + declinedOrExpired;
    // No dispatch history yet -> benefit of the doubt (matches the dispatch
    // engine's own "don't punish a brand-new master" stance from M3).
    const responseRate = responseDenominator > 0 ? accepted / responseDenominator : 1;

    const activePenaltyPoints = penaltyAgg._sum.points ?? 0;

    const jobsDoneFactor = Math.min(master.jobsDone, JOBS_DONE_CAP) / JOBS_DONE_CAP;
    const ratingAvg = Number(master.ratingAvg);
    const ratingFactor = ratingAvg / 5;
    const verificationFactor = master.verificationStatus === 'VERIFIED' ? 1 : 0;

    const rawScore =
      jobsDoneFactor * TRUST_WEIGHTS.jobsDone +
      ratingFactor * TRUST_WEIGHTS.rating +
      responseRate * TRUST_WEIGHTS.responseRate +
      (1 - cancellationRate) * TRUST_WEIGHTS.cancellationRate +
      verificationFactor * TRUST_WEIGHTS.verification;

    const penaltyDeduction = Math.min(MAX_PENALTY_DEDUCTION, activePenaltyPoints);
    const score = Math.max(0, Math.min(100, Math.round(rawScore - penaltyDeduction)));
    const tier = scoreToTier(score);

    return {
      score,
      tier,
      factors: {
        jobsDone: master.jobsDone,
        ratingAvg,
        cancellationRate,
        responseRate,
        verificationStatus: master.verificationStatus,
        activePenaltyPoints,
      },
    };
  }

  /**
   * Computes and persists MasterProfile.trustTier. Called explicitly after
   * specific events (job confirmed closed, review posted, penalty issued) —
   * never on a background schedule, per "do not automatically change trust
   * tiers without clear rules." The rule IS clear: it's this function, run
   * at well-defined trigger points.
   */
  async recomputeTrustTier(masterId: string): Promise<TrustScoreDto> {
    const result = await this.computeTrustScore(masterId);
    await this.prisma.masterProfile.update({
      where: { userId: masterId },
      data: { trustTier: result.tier },
    });
    return result;
  }
}
