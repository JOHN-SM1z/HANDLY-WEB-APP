import { ConflictException, Injectable } from '@nestjs/common';
import type { MasterSubscriptionDto } from '@handly/contracts';
import type { MasterSubscription } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

/** No billing yet (explicit scope boundary) — trial length is the only "plan economics" that exists. */
const TRIAL_DAYS = 14;

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Free tier is the implicit default (no row). Lazily self-heals an expired
   * trial to EXPIRED on read — same "recompute on read, no cron" shape as
   * TrustService, rather than a background job for something this cheap.
   */
  async getStatus(masterId: string): Promise<MasterSubscriptionDto> {
    const row = await this.prisma.masterSubscription.findUnique({ where: { masterId } });
    if (!row) return this.freeDto();

    if (row.status === 'TRIAL' && row.trialEndsAt && row.trialEndsAt < new Date()) {
      const expired = await this.prisma.masterSubscription.update({
        where: { masterId },
        data: { status: 'EXPIRED' },
      });
      return this.toDto(expired);
    }
    return this.toDto(row);
  }

  /** Starts (or restarts, if previously cancelled/expired) a 14-day Premium trial. No payment involved. */
  async upgradeToPremium(masterId: string): Promise<MasterSubscriptionDto> {
    const existing = await this.getStatus(masterId);
    if (existing.isPremiumActive) {
      throw new ConflictException('Siz allaqachon Premium obunachisiz');
    }
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const row = await this.prisma.masterSubscription.upsert({
      where: { masterId },
      create: { masterId, plan: 'PREMIUM', status: 'TRIAL', trialEndsAt },
      update: { plan: 'PREMIUM', status: 'TRIAL', trialEndsAt, currentPeriodEnd: null },
    });
    return this.toDto(row);
  }

  /** Cheap direct check for the dispatch-scoring hook — avoids building the whole DTO. */
  async isPremiumActive(masterId: string): Promise<boolean> {
    const status = await this.getStatus(masterId);
    return status.isPremiumActive;
  }

  private freeDto(): MasterSubscriptionDto {
    return { plan: 'FREE', status: 'ACTIVE', trialEndsAt: null, currentPeriodEnd: null, isPremiumActive: false };
  }

  private toDto(row: MasterSubscription): MasterSubscriptionDto {
    const isPremiumActive = row.plan === 'PREMIUM' && (row.status === 'ACTIVE' || row.status === 'TRIAL');
    return {
      plan: row.plan as MasterSubscriptionDto['plan'],
      status: row.status as MasterSubscriptionDto['status'],
      trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
      currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
      isPremiumActive,
    };
  }
}
