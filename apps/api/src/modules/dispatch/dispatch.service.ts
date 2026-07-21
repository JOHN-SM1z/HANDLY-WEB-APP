import { ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { type OfferDto, OrderStatus, type ServiceTier, tashkentTodayDateStr } from '@handly/contracts';
import { AppConfig } from '../../infra/config/app-config';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { DISPATCH_QUEUE } from '../../infra/queue/queue.module';
import {
  DispatchJobName,
  type OfferExpiryJobData,
  offerExpiryJobId,
} from '../../infra/queue/queue.constants';
import { canTransition } from '../orders/order-state';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { findEligibleCandidates } from './dispatch-eligibility';
import { requiredTierForComplexity, scoreCandidate, weightedRandomPick } from './dispatch-scoring';

const PRISMA_UNIQUE_CONSTRAINT_CODE = 'P2002';

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeGateway,
    @Inject(DISPATCH_QUEUE) private readonly queue: Queue,
  ) {}

  // ─────────────── Entry points ───────────────

  /** Called by OrdersService.submit() right after the order enters SEARCHING. */
  async startDispatch(orderId: string): Promise<void> {
    await this.cascadeNext(orderId, 1);
  }

  /** Called by the BullMQ worker when an offer's expiresAt passes. Idempotent. */
  async handleOfferExpiry(dispatchId: string): Promise<void> {
    const dispatch = await this.prisma.orderDispatch.updateMany({
      where: { id: dispatchId, status: 'OFFERED' },
      data: { status: 'EXPIRED', respondedAt: new Date() },
    });
    if (dispatch.count === 0) return; // already accepted/declined/withdrawn — no-op

    const full = await this.prisma.orderDispatch.findUnique({ where: { id: dispatchId } });
    if (!full) return;
    await this.notifications.notify(full.masterId, 'OFFER_EXPIRED', 'Taklif muddati tugadi', 'Javob berish vaqti tugadi.', {
      orderId: full.orderId,
    });
    await this.cascadeNext(full.orderId, 1);
  }

  /**
   * Offer the next eligible candidate, or exhaust the pool. `attempt` 1 is
   * the normal-radius pass; `attempt` 2 is the one expanded-radius retry
   * (§9.2.5) — always starts back at 1, cascadeNext escalates internally.
   */
  async cascadeNext(orderId: string, attempt: 1 | 2): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== OrderStatus.SEARCHING) return; // cancelled/already assigned/etc. — no-op
    if (!order.categoryId || order.latitude == null || order.longitude == null) {
      await this.failSearch(orderId, 'missing category or location');
      return;
    }

    const rankSoFar = await this.prisma.orderDispatch.count({ where: { orderId } });
    const candidates = await findEligibleCandidates(this.prisma, {
      orderId,
      categoryId: order.categoryId,
      requiredTier: requiredTierForComplexity(order.complexity),
      todayDateStr: tashkentTodayDateStr(),
      radiusMultiplier: attempt === 1 ? 1 : this.config.env.DISPATCH_RADIUS_EXPANSION_FACTOR,
      limit: this.config.env.DISPATCH_TOP_N,
    });

    if (candidates.length === 0) {
      if (attempt === 1) {
        await this.cascadeNext(orderId, 2);
        return;
      }
      await this.failSearch(orderId, 'pool exhausted after radius expansion');
      return;
    }

    const picked = weightedRandomPick(candidates, (c) => scoreCandidate(c));
    const score = scoreCandidate(picked);
    const ttlSeconds = offerTtlSeconds(order.serviceTier as ServiceTier, this.config);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    let dispatchId: string;
    try {
      const dispatch = await this.prisma.orderDispatch.create({
        data: {
          orderId,
          masterId: picked.masterId,
          rankInCascade: rankSoFar + 1,
          distanceM: picked.distanceM,
          score,
          expiresAt,
        },
      });
      dispatchId = dispatch.id;
    } catch (err) {
      // Unique (orderId, masterId) — already offered this master (concurrent
      // trigger race). Idempotent: just try the next candidate.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === PRISMA_UNIQUE_CONSTRAINT_CODE) {
        await this.cascadeNext(orderId, attempt);
        return;
      }
      throw err;
    }

    await this.queue.add(
      DispatchJobName.OFFER_EXPIRY,
      { dispatchId } satisfies OfferExpiryJobData,
      { jobId: offerExpiryJobId(dispatchId), delay: ttlSeconds * 1000 },
    );

    const offer = await this.toOfferDto(dispatchId);
    if (offer) this.realtime.emitToUser(picked.masterId, 'offer:received', offer);
    await this.notifications.notify(
      picked.masterId,
      'OFFER_RECEIVED',
      'Yangi buyurtma taklifi',
      order.description.slice(0, 120),
      { orderId, dispatchId },
    );
  }

  // ─────────────── Master actions ───────────────

  async getCurrentOffer(masterId: string): Promise<OfferDto | null> {
    const dispatch = await this.prisma.orderDispatch.findFirst({
      where: { masterId, status: 'OFFERED', expiresAt: { gt: new Date() } },
      orderBy: { offeredAt: 'desc' },
    });
    return dispatch ? this.toOfferDto(dispatch.id) : null;
  }

  async acceptOffer(dispatchId: string, masterId: string): Promise<void> {
    const dispatch = await this.prisma.orderDispatch.findUnique({ where: { id: dispatchId } });
    if (!dispatch) throw new NotFoundException('Taklif topilmadi');
    if (dispatch.masterId !== masterId) throw new ForbiddenException("Ruxsat yo'q");

    const { customerId, orderId, notification } = await this.prisma.$transaction(async (tx) => {
      // Locks the order row so a concurrent accept on a *different* dispatch
      // for the same order blocks here, then correctly sees status!=SEARCHING
      // once this transaction commits — exactly one ACCEPTED can ever exist.
      await tx.$executeRaw`SELECT id FROM orders WHERE id = ${dispatch.orderId}::uuid FOR UPDATE`;

      const order = await tx.order.findUniqueOrThrow({ where: { id: dispatch.orderId } });
      const fresh = await tx.orderDispatch.findUniqueOrThrow({ where: { id: dispatchId } });

      if (fresh.status !== 'OFFERED' || fresh.expiresAt.getTime() < Date.now()) {
        throw new ConflictException('Taklif muddati tugagan');
      }
      if (!canTransition(order.status as OrderStatus, OrderStatus.ASSIGNED)) {
        throw new ConflictException('Bu buyurtma allaqachon band qilingan yoki bekor qilingan');
      }

      await tx.orderDispatch.update({
        where: { id: dispatchId },
        data: { status: 'ACCEPTED', countedAsLead: true, respondedAt: new Date() },
      });
      await tx.orderDispatch.updateMany({
        where: { orderId: dispatch.orderId, status: 'OFFERED', id: { not: dispatchId } },
        data: { status: 'WITHDRAWN', respondedAt: new Date() },
      });
      await tx.order.update({
        where: { id: dispatch.orderId },
        data: {
          status: OrderStatus.ASSIGNED,
          masterId,
          statusHistory: {
            create: { fromStatus: order.status, toStatus: OrderStatus.ASSIGNED, actorId: masterId },
          },
        },
      });
      const notification = await this.notifications.createRecord(
        tx,
        order.customerId,
        'ORDER_ASSIGNED',
        'Usta tayinlandi',
        'Sizga mos usta topildi va buyurtmangizni qabul qildi.',
        { orderId: order.id },
      );
      return { customerId: order.customerId, orderId: order.id, notification };
    });

    this.realtime.emitToUser(customerId, 'order:updated', { orderId, status: OrderStatus.ASSIGNED });
    this.notifications.deliver(notification);
  }

  async declineOffer(dispatchId: string, masterId: string): Promise<void> {
    const dispatch = await this.prisma.orderDispatch.findUnique({ where: { id: dispatchId } });
    if (!dispatch) throw new NotFoundException('Taklif topilmadi');
    if (dispatch.masterId !== masterId) throw new ForbiddenException("Ruxsat yo'q");

    const updated = await this.prisma.orderDispatch.updateMany({
      where: { id: dispatchId, status: 'OFFERED' },
      data: { status: 'DECLINED', respondedAt: new Date() },
    });
    if (updated.count === 0) return; // already responded/expired — idempotent no-op

    await this.cascadeNext(dispatch.orderId, 1);
  }

  // ─────────────── Helpers ───────────────

  private async failSearch(orderId: string, reason: string): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || !canTransition(order.status as OrderStatus, OrderStatus.EXPIRED)) return;
    this.logger.log(`Dispatch exhausted for order ${orderId}: ${reason}`);
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.EXPIRED,
        statusHistory: { create: { fromStatus: order.status, toStatus: OrderStatus.EXPIRED, note: reason } },
      },
    });
    this.realtime.emitToUser(order.customerId, 'order:updated', { orderId, status: OrderStatus.EXPIRED });
    await this.notifications.notify(
      order.customerId,
      'ORDER_SEARCH_FAILED',
      'Usta topilmadi',
      "Hozircha mos usta topilmadi. Qayta urinib ko'ring yoki qo'llab-quvvatlash xizmatiga murojaat qiling.",
      { orderId },
    );
  }

  private async toOfferDto(dispatchId: string): Promise<OfferDto | null> {
    const dispatch = await this.prisma.orderDispatch.findUnique({
      where: { id: dispatchId },
      include: { order: { include: { category: true } } },
    });
    if (!dispatch) return null;
    const { order } = dispatch;
    return {
      dispatchId: dispatch.id,
      orderId: order.id,
      orderNo: order.orderNo,
      categoryName: order.category?.nameUz ?? null,
      description: order.description,
      serviceTier: order.serviceTier as ServiceTier,
      complexity: order.complexity as OfferDto['complexity'],
      addressText: order.addressText,
      distanceM: dispatch.distanceM,
      priceMin: order.priceMin,
      priceMax: order.priceMax,
      platformFee: order.platformFee,
      offeredAt: dispatch.offeredAt.toISOString(),
      expiresAt: dispatch.expiresAt.toISOString(),
    };
  }
}

function offerTtlSeconds(serviceTier: ServiceTier, config: AppConfig): number {
  switch (serviceTier) {
    case 'EMERGENCY':
      return config.env.DISPATCH_OFFER_TTL_EMERGENCY_SECONDS;
    case 'PRIORITY':
      return config.env.DISPATCH_OFFER_TTL_PRIORITY_SECONDS;
    default:
      return config.env.DISPATCH_OFFER_TTL_SCHEDULED_SECONDS;
  }
}
