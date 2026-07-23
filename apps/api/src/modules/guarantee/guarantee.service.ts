import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { GuaranteeClaimDto } from '@handly/contracts';
import type { GuaranteeClaim } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class GuaranteeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Eligibility (per the batch spec): order must be CLOSED, its master must
   * be VERIFIED, and a SUCCEEDED payment must exist for it. No automated
   * adjudication — this just opens a claim; a human (Batch 3 admin) decides.
   */
  async fileClaim(customerId: string, orderId: string, reason: string): Promise<GuaranteeClaimDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { master: true, payments: { where: { status: 'SUCCEEDED' } } },
    });
    if (!order) throw new NotFoundException('Buyurtma topilmadi');
    if (order.customerId !== customerId) throw new ForbiddenException("Ruxsat yo'q");
    if (order.status !== 'CLOSED') {
      throw new ConflictException('Faqat yakunlangan buyurtmalar uchun kafolat talab qilish mumkin');
    }
    if (!order.master || order.master.verificationStatus !== 'VERIFIED') {
      throw new ConflictException('Kafolat faqat tasdiqlangan ustalar uchun amal qiladi');
    }
    if (order.payments.length === 0) {
      throw new ConflictException("Kafolat uchun to'lov amalga oshirilgan bo'lishi kerak");
    }

    const existing = await this.prisma.guaranteeClaim.findUnique({ where: { orderId } });
    if (existing) throw new ConflictException('Bu buyurtma uchun kafolat so\'rovi allaqachon mavjud');

    const claim = await this.prisma.guaranteeClaim.create({
      data: { orderId, customerId, reason, status: 'OPEN' },
    });
    return this.toDto(claim);
  }

  async getForOrder(customerId: string, orderId: string): Promise<GuaranteeClaimDto | null> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Buyurtma topilmadi');
    if (order.customerId !== customerId) throw new ForbiddenException("Ruxsat yo'q");
    const claim = await this.prisma.guaranteeClaim.findUnique({ where: { orderId } });
    return claim ? this.toDto(claim) : null;
  }

  /** Admin-ready decision — no dashboard UI yet (Batch 3). */
  async decide(claimId: string, adminId: string, approve: boolean, resolutionNote?: string): Promise<GuaranteeClaimDto> {
    const claim = await this.prisma.guaranteeClaim.findUnique({ where: { id: claimId } });
    if (!claim) throw new NotFoundException("So'rov topilmadi");
    if (claim.status !== 'OPEN' && claim.status !== 'UNDER_REVIEW') {
      throw new ConflictException('Bu soʻrov allaqachon yopilgan');
    }

    // Guarded on status still matching what we just read — two concurrent
    // decide() calls on the same claim would otherwise both pass the
    // pre-check above and both write, sending two decision notifications
    // for one claim. Same CAS-via-updateMany pattern used throughout this
    // codebase (e.g. OrdersService's job-execution transitions).
    const result = await this.prisma.guaranteeClaim.updateMany({
      where: { id: claimId, status: claim.status },
      data: {
        status: approve ? 'APPROVED' : 'REJECTED',
        decidedBy: adminId,
        decidedAt: new Date(),
        resolutionNote,
      },
    });
    if (result.count !== 1) {
      throw new ConflictException('Bu soʻrov allaqachon yopilgan');
    }
    const updated = await this.prisma.guaranteeClaim.findUniqueOrThrow({ where: { id: claimId } });

    await this.notifications.notify(
      claim.customerId,
      'GUARANTEE_CLAIM_DECIDED',
      approve ? 'Kafolat so\'rovi tasdiqlandi' : "Kafolat so'rovi rad etildi",
      resolutionNote ?? '',
      { claimId, orderId: claim.orderId },
    );

    return this.toDto(updated);
  }

  private toDto(c: GuaranteeClaim): GuaranteeClaimDto {
    return {
      id: c.id,
      orderId: c.orderId,
      reason: c.reason,
      status: c.status as GuaranteeClaimDto['status'],
      resolutionNote: c.resolutionNote,
      decidedAt: c.decidedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    };
  }
}
