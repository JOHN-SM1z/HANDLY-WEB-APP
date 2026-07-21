import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { ReviewDto } from '@handly/contracts';
import type { Review } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { PenaltiesService } from '../penalties/penalties.service';
import { TrustService } from '../trust/trust.service';

/** A review at or below this rating also counts as a customer complaint for the penalty engine. */
const COMPLAINT_RATING_THRESHOLD = 2;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trust: TrustService,
    private readonly penalties: PenaltiesService,
  ) {}

  /**
   * Customer rates a CLOSED order — one review per order (unique constraint
   * on Review.orderId), real data source for MasterProfile.ratingAvg (was
   * static/seed-only before this batch), the trust score's rating factor,
   * and the penalty engine's low-rating complaint trigger.
   */
  async create(customerId: string, orderId: string, rating: number, comment?: string): Promise<ReviewDto> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Buyurtma topilmadi');
    if (order.customerId !== customerId) throw new ForbiddenException("Ruxsat yo'q");
    if (order.status !== 'CLOSED') {
      throw new ConflictException('Faqat yakunlangan buyurtmalarga baho qo\'yish mumkin');
    }
    if (!order.masterId) throw new ConflictException('Buyurtmaga usta tayinlanmagan');

    const existing = await this.prisma.review.findUnique({ where: { orderId } });
    if (existing) throw new ConflictException("Bu buyurtmaga baho allaqachon qo'yilgan");

    const masterId = order.masterId;
    const review = await this.prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: { orderId, customerId, masterId, rating, comment },
      });
      const agg = await tx.review.aggregate({ where: { masterId }, _avg: { rating: true } });
      await tx.masterProfile.update({
        where: { userId: masterId },
        data: { ratingAvg: agg._avg.rating ?? rating },
      });
      return created;
    });

    if (rating <= COMPLAINT_RATING_THRESHOLD) {
      await this.penalties.recordEvent(masterId, 'CUSTOMER_COMPLAINT', orderId, `${rating}/5 baho`);
      // recordEvent already recomputes trust; skip the redundant call below.
    } else {
      await this.trust.recomputeTrustTier(masterId);
    }

    return this.toDto(review);
  }

  async getForOrder(orderId: string): Promise<ReviewDto | null> {
    const review = await this.prisma.review.findUnique({ where: { orderId } });
    return review ? this.toDto(review) : null;
  }

  async getRecentForMaster(masterId: string, take: number): Promise<ReviewDto[]> {
    const reviews = await this.prisma.review.findMany({
      where: { masterId },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return reviews.map((r) => this.toDto(r));
  }

  private toDto(r: Review): ReviewDto {
    return {
      id: r.id,
      orderId: r.orderId,
      masterId: r.masterId,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
