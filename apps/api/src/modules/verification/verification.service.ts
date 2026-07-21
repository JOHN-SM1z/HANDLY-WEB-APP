import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { VerificationRecordDto } from '@handly/contracts';
import type { Verification } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Master submits (or resubmits after a rejection) a verification request. */
  async submit(masterId: string, note?: string): Promise<VerificationRecordDto> {
    const master = await this.prisma.masterProfile.findUnique({ where: { userId: masterId } });
    if (!master) throw new NotFoundException('Usta profili topilmadi');
    if (master.verificationStatus === 'VERIFIED') {
      throw new ConflictException('Siz allaqachon tasdiqlangansiz');
    }
    const pending = await this.prisma.verification.findFirst({
      where: { masterId, status: 'PENDING' },
    });
    if (pending) {
      throw new ConflictException("Ko'rib chiqilayotgan so'rovingiz bor");
    }

    const [record] = await this.prisma.$transaction([
      this.prisma.verification.create({
        data: { masterId, provider: 'MANUAL', status: 'PENDING', note },
      }),
      this.prisma.masterProfile.update({
        where: { userId: masterId },
        data: { verificationStatus: 'PENDING' },
      }),
    ]);
    return this.toDto(record);
  }

  async getMyLatest(masterId: string): Promise<VerificationRecordDto | null> {
    const record = await this.prisma.verification.findFirst({
      where: { masterId },
      orderBy: { createdAt: 'desc' },
    });
    return record ? this.toDto(record) : null;
  }

  /**
   * Admin-ready decision — no dashboard UI yet (Batch 3), but the lifecycle
   * itself is real: approve/reject is guarded to ADMIN role at the controller.
   */
  async decide(
    verificationId: string,
    adminId: string,
    approve: boolean,
    note?: string,
  ): Promise<VerificationRecordDto> {
    const record = await this.prisma.verification.findUnique({ where: { id: verificationId } });
    if (!record) throw new NotFoundException("So'rov topilmadi");
    if (record.status !== 'PENDING') {
      throw new ConflictException('Bu soʻrov allaqachon koʻrib chiqilgan');
    }
    if (!approve && !note) {
      throw new BadRequestException('Rad etish sababini kiriting');
    }

    const newStatus = approve ? 'VERIFIED' : 'REJECTED';
    const [updated] = await this.prisma.$transaction([
      this.prisma.verification.update({
        where: { id: verificationId },
        data: { status: newStatus, decidedBy: adminId, decidedAt: new Date(), note: note ?? record.note },
      }),
      this.prisma.masterProfile.update({
        where: { userId: record.masterId },
        data: { verificationStatus: newStatus },
      }),
    ]);

    await this.notifications.notify(
      record.masterId,
      approve ? 'VERIFICATION_APPROVED' : 'VERIFICATION_REJECTED',
      approve ? 'Tasdiqlandingiz' : "So'rov rad etildi",
      approve
        ? "Tabriklaymiz! Profilingiz tasdiqlandi."
        : (note ?? "So'rovingiz rad etildi."),
      { verificationId },
    );

    return this.toDto(updated);
  }

  private toDto(v: Verification): VerificationRecordDto {
    return {
      id: v.id,
      status: v.status as VerificationRecordDto['status'],
      provider: v.provider as VerificationRecordDto['provider'],
      note: v.note,
      decidedAt: v.decidedAt?.toISOString() ?? null,
      createdAt: v.createdAt.toISOString(),
    };
  }
}
