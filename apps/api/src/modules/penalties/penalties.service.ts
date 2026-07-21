import { Injectable } from '@nestjs/common';
import type { PenaltyEventType, PenaltyHistoryPage, PenaltyRecordDto } from '@handly/contracts';
import type { PenaltyRecord } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TrustService } from '../trust/trust.service';
import { PENALTY_LOOKBACK_DAYS } from '../trust/trust-config';
import { PENALTY_RULES } from './penalty-rules';

@Injectable()
export class PenaltiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trust: TrustService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Centralized entry point — every penalty-worthy event across the app goes
   * through this one method rather than scattering ad-hoc point deductions.
   * Never bans/suspends; only records the event and recomputes trust (which
   * itself is capped/deterministic, see TrustService).
   */
  async recordEvent(
    masterId: string,
    eventType: PenaltyEventType,
    orderId?: string,
    note?: string,
  ): Promise<PenaltyRecordDto> {
    const rule = PENALTY_RULES[eventType];
    const record = await this.prisma.penaltyRecord.create({
      data: {
        masterId,
        eventType,
        severity: rule.severity,
        points: rule.points,
        orderId,
        note,
      },
    });

    await this.trust.recomputeTrustTier(masterId);
    await this.notifications.notify(
      masterId,
      'PENALTY_ISSUED',
      'Jarima qayd etildi',
      `${this.eventLabel(eventType)} uchun ${rule.points} ball jarima yozildi.`,
      { penaltyRecordId: record.id, eventType },
    );

    return this.toDto(record);
  }

  async getHistory(masterId: string): Promise<PenaltyHistoryPage> {
    const items = await this.prisma.penaltyRecord.findMany({
      where: { masterId },
      orderBy: { createdAt: 'desc' },
    });
    const agg = await this.prisma.penaltyRecord.aggregate({
      where: {
        masterId,
        createdAt: { gte: new Date(Date.now() - PENALTY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000) },
      },
      _sum: { points: true },
    });
    return { items: items.map((r) => this.toDto(r)), activePoints: agg._sum.points ?? 0 };
  }

  private eventLabel(type: PenaltyEventType): string {
    const labels: Record<PenaltyEventType, string> = {
      CANCELLATION: 'Buyurtmani bekor qilish',
      NO_SHOW: 'Kelmaslik',
      LATE_RESPONSE: 'Kech javob berish',
      POOR_QUALITY: "Sifat pastligi",
      CUSTOMER_COMPLAINT: 'Mijoz shikoyati',
    };
    return labels[type];
  }

  private toDto(r: PenaltyRecord): PenaltyRecordDto {
    return {
      id: r.id,
      eventType: r.eventType as PenaltyRecordDto['eventType'],
      severity: r.severity as PenaltyRecordDto['severity'],
      points: r.points,
      orderId: r.orderId,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
