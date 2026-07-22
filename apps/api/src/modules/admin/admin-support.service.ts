import { Injectable, NotFoundException } from '@nestjs/common';
import type { AdminSupportLookupDto } from '@handly/contracts';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { PenaltiesService } from '../penalties/penalties.service';
import { ReferralsService } from '../referrals/referrals.service';
import { AdminUsersService } from './admin-users.service';

/**
 * Consolidated "search a person, see everything" support view. Composes
 * existing Batch 2 read methods (PenaltiesService.getHistory,
 * ReferralsService.getSummary) rather than duplicating their logic — reads
 * payments directly here instead of adding a new method to PaymentsService,
 * per the "don't modify Batch 1/2 files" constraint.
 */
@Injectable()
export class AdminSupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminUsers: AdminUsersService,
    private readonly penalties: PenaltiesService,
    private readonly referrals: ReferralsService,
  ) {}

  async lookupByPhone(phone: string): Promise<AdminSupportLookupDto> {
    const found = await this.prisma.user.findUnique({ where: { phone } });
    if (!found) throw new NotFoundException('Foydalanuvchi topilmadi');

    const [user, payments, penaltyHistory, referralSummary] = await Promise.all([
      this.adminUsers.detail(found.id),
      this.prisma.payment.findMany({
        where: { customerId: found.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      found.role === 'MASTER' ? this.penalties.getHistory(found.id) : Promise.resolve(null),
      this.referrals.getSummary(found.id),
    ]);

    return {
      user,
      payments: payments.map((p) => ({
        id: p.id,
        orderId: p.orderId,
        method: p.method,
        status: p.status,
        amount: p.amount,
        createdAt: p.createdAt.toISOString(),
      })),
      penalties: penaltyHistory
        ? {
            items: penaltyHistory.items.map((i) => ({
              eventType: i.eventType,
              severity: i.severity,
              points: i.points,
              createdAt: i.createdAt,
            })),
            activePoints: penaltyHistory.activePoints,
          }
        : null,
      referrals: {
        referralCode: referralSummary.referralCode,
        totalReferred: referralSummary.totalReferred,
        totalRewarded: referralSummary.totalRewarded,
        totalCashbackEarned: referralSummary.totalCashbackEarned,
      },
    };
  }
}
