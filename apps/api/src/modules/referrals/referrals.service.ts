import { Injectable, Logger } from '@nestjs/common';
import type { ReferralSummaryDto } from '@handly/contracts';
import { PrismaService } from '../../infra/prisma/prisma.service';

/** Fixed cashback amount granted to the referrer, in integer so'm. No withdrawal system yet. */
export const REFERRAL_REWARD_AMOUNT = 20_000;

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Called from AuthService.register for a brand-new user with a
   * `referredByCode`. Silently no-ops on an invalid code or a self-referral
   * (own code) rather than failing registration over a growth feature.
   */
  async recordSignup(refereeId: string, referredByCode?: string): Promise<void> {
    if (!referredByCode) return;
    const referrer = await this.prisma.user.findUnique({ where: { referralCode: referredByCode } });
    if (!referrer || referrer.id === refereeId) return;

    await this.prisma.referral.create({
      data: { referrerId: referrer.id, refereeId, status: 'PENDING' },
    }).catch((err: unknown) => {
      // Referral.refereeId is unique — a retried/duplicate registration attempt
      // hitting this twice is a harmless no-op, not a failure worth surfacing.
      this.logger.debug(`recordSignup no-op for ${refereeId}: ${String(err)}`);
    });
  }

  /** Called when the referee's account transitions PENDING → ACTIVE (OTP verified). */
  async activateOnVerify(refereeId: string): Promise<void> {
    await this.prisma.referral.updateMany({
      where: { refereeId, status: 'PENDING' },
      data: { status: 'ACTIVE' },
    });
  }

  /**
   * Called from PaymentsService after a SUCCEEDED payment. Rewards the
   * referrer exactly once per referral (guarded by the status transition,
   * ACTIVE → REWARDED — a second successful payment by the same referee
   * is a no-op since the referral is no longer ACTIVE). Returns the
   * referrer's userId when a reward was actually granted this call (so the
   * caller can notify them), or null otherwise. ReferralsService deliberately
   * has no dependency on NotificationsModule — PaymentsService already
   * depends on both and sends the notification itself; wiring Notifications
   * in here would recreate the AuthModule -> ReferralsModule ->
   * NotificationsModule -> RealtimeModule -> AuthModule circular-import cycle
   * that broke Nest's boot when this was first built.
   */
  async rewardOnFirstPayment(refereeId: string): Promise<string | null> {
    const referral = await this.prisma.referral.findUnique({ where: { refereeId } });
    if (!referral || referral.status !== 'ACTIVE') return null;

    const result = await this.prisma.referral.updateMany({
      where: { id: referral.id, status: 'ACTIVE' },
      data: { status: 'REWARDED', rewardedAt: new Date() },
    });
    if (result.count !== 1) return null; // lost a race to another concurrent settle — safe no-op

    await this.prisma.cashbackRecord.create({
      data: {
        userId: referral.referrerId,
        amount: REFERRAL_REWARD_AMOUNT,
        sourceType: 'REFERRAL_REWARD',
        status: 'ELIGIBLE',
        referralId: referral.id,
        note: 'Referal mukofoti',
      },
    });
    return referral.referrerId;
  }

  async getSummary(userId: string): Promise<ReferralSummaryDto> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const [referrals, cashbackRecords] = await Promise.all([
      this.prisma.referral.findMany({
        where: { referrerId: userId },
        include: { referee: { select: { phone: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.cashbackRecord.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      referralCode: user.referralCode,
      totalReferred: referrals.length,
      totalRewarded: referrals.filter((r) => r.status === 'REWARDED').length,
      totalCashbackEarned: cashbackRecords.reduce((sum, c) => sum + c.amount, 0),
      referrals: referrals.map((r) => ({
        id: r.id,
        refereeId: r.refereeId,
        refereePhoneMasked: maskPhone(r.referee.phone),
        status: r.status as ReferralSummaryDto['referrals'][number]['status'],
        rewardedAt: r.rewardedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      cashbackRecords: cashbackRecords.map((c) => ({
        id: c.id,
        amount: c.amount,
        sourceType: c.sourceType as ReferralSummaryDto['cashbackRecords'][number]['sourceType'],
        status: c.status as ReferralSummaryDto['cashbackRecords'][number]['status'],
        note: c.note,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  }
}

/** "+998901234567" -> "+998 90 *** ** 67" — enough for the referrer to recognize who, not the full number. */
function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  return `${phone.slice(0, 6)}***${phone.slice(-2)}`;
}
