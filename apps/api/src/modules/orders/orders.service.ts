import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { Prisma, Order as OrderRow, OrderMedia, OrderStatusHistory, ServiceCategory } from '@prisma/client';
import {
  type AiDiagnosisDto,
  type OrderCreateInput,
  type OrderDto,
  type OrderListPage,
  ORDER_MAX_DAYS_AHEAD,
  ORDER_TIME_SLOTS,
  OrderStatus,
  type OrderUpdateInput,
  utcIsoToSlot,
} from '@handly/contracts';
import { AppConfig } from '../../infra/config/app-config';
import { matchesMagicBytes } from '../../infra/storage/magic-bytes';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { STORAGE_PROVIDER, type StorageProvider } from '../../infra/storage/storage-provider';
import { AiService } from '../ai/ai.service';
import type { DiagnoseImage } from '../ai/ai-provider';
import { DispatchService } from '../dispatch/dispatch.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PenaltiesService } from '../penalties/penalties.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { TrustService } from '../trust/trust.service';
import { ACTIVE_MASTER_JOB_STATUSES, canTransition, EDITABLE_STATUSES } from './order-state';
import { computeQuote } from './pricing';

const PHOTO_MIMES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/heic': '.heic',
};
const VIDEO_MIMES: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
};
/** Photo mimes Claude vision accepts (heic is stored but not sent to AI). */
const AI_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const AI_MAX_IMAGES = 3;
const AI_MAX_IMAGE_BYTES = 4 * 1024 * 1024;

type OrderWithRelations = OrderRow & {
  category: ServiceCategory | null;
  media: OrderMedia[];
  statusHistory: OrderStatusHistory[];
  master:
    | {
        userId: string;
        fullName: string | null;
        ratingAvg: Prisma.Decimal;
        jobsDone: number;
        user: { phone: string };
      }
    | null;
  customer: { id: string; phone: string; customerProfile: { fullName: string | null } | null };
};

const FULL_INCLUDE = {
  category: true,
  media: { orderBy: { createdAt: 'asc' as const } },
  statusHistory: { orderBy: { createdAt: 'asc' as const } },
  master: {
    select: { userId: true, fullName: true, ratingAvg: true, jobsDone: true, user: { select: { phone: true } } },
  },
  // Beta Blocker Sprint — minimal customer↔master contact. Only ever exposed
  // in toDto() once order.masterId is set (mirrors `master`'s own relation-
  // driven null-until-ASSIGNED shape) — fetched here unconditionally since
  // Order.customer is a required (non-optional) relation.
  customer: { select: { id: true, phone: true, customerProfile: { select: { fullName: true } } } },
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly ai: AiService,
    private readonly dispatch: DispatchService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
    private readonly trust: TrustService,
    private readonly penalties: PenaltiesService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  // ─────────────── CRUD ───────────────

  async createDraft(customerId: string, dto: OrderCreateInput): Promise<OrderDto> {
    if (dto.categoryId) await this.assertCategory(dto.categoryId);
    const order = await this.prisma.order.create({
      data: {
        customerId,
        categoryId: dto.categoryId,
        description: dto.description,
        statusHistory: { create: { toStatus: OrderStatus.DRAFT, actorId: customerId } },
      },
      include: FULL_INCLUDE,
    });
    return this.toDto(order);
  }

  async updateDraft(customerId: string, orderId: string, dto: OrderUpdateInput): Promise<OrderDto> {
    const order = await this.getOwned(customerId, orderId);
    if (!EDITABLE_STATUSES.includes(order.status as OrderStatus)) {
      throw new ConflictException("Yuborilgan buyurtmani o'zgartirib bo'lmaydi");
    }
    if (dto.categoryId) await this.assertCategory(dto.categoryId);
    if (dto.scheduledAt) this.assertSchedulable(new Date(dto.scheduledAt));

    const data: Prisma.OrderUpdateInput = {
      ...(dto.categoryId !== undefined ? { category: { connect: { id: dto.categoryId } } } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.serviceTier !== undefined ? { serviceTier: dto.serviceTier } : {}),
      ...(dto.scheduledAt !== undefined
        ? { scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null }
        : {}),
      ...(dto.addressText !== undefined ? { addressText: dto.addressText } : {}),
      ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
      ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
    };

    // Editing a PRICED order invalidates its quote → back to DRAFT (recorded).
    const invalidatesQuote =
      order.status === OrderStatus.PRICED &&
      (dto.description !== undefined || dto.categoryId !== undefined || dto.serviceTier !== undefined);
    if (invalidatesQuote) {
      data.status = OrderStatus.DRAFT;
      data.priceMin = null;
      data.priceMax = null;
      data.statusHistory = {
        create: {
          fromStatus: OrderStatus.PRICED,
          toStatus: OrderStatus.DRAFT,
          actorId: customerId,
          note: 'edited-after-quote',
        },
      };
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data,
      include: FULL_INCLUDE,
    });
    return this.toDto(updated);
  }

  // ─────────────── Media ───────────────

  async addMedia(
    customerId: string,
    orderId: string,
    file: { buffer: Buffer; mime: string },
  ): Promise<OrderDto> {
    const order = await this.getOwned(customerId, orderId);
    if (!EDITABLE_STATUSES.includes(order.status as OrderStatus)) {
      throw new ConflictException("Yuborilgan buyurtmaga media qo'shib bo'lmaydi");
    }
    await this.saveMediaFile(order, file, 'CUSTOMER');
    return this.toDto(await this.getOwned(customerId, orderId));
  }

  /** Master-uploaded job-completion evidence (M4) — same table, tagged by role. */
  async addJobMedia(
    masterId: string,
    orderId: string,
    file: { buffer: Buffer; mime: string },
  ): Promise<OrderDto> {
    const order = await this.getOwnedByMaster(masterId, orderId);
    if (order.status !== OrderStatus.IN_PROGRESS && order.status !== OrderStatus.COMPLETED) {
      throw new ConflictException("Bu holatda dalil-rasm qo'shib bo'lmaydi");
    }
    await this.saveMediaFile(order, file, 'MASTER');
    return this.toDto(await this.getOwnedByMaster(masterId, orderId));
  }

  private async saveMediaFile(
    order: OrderWithRelations,
    file: { buffer: Buffer; mime: string },
    uploadedByRole: 'CUSTOMER' | 'MASTER',
  ): Promise<void> {
    if (order.media.length >= this.config.env.ORDER_MAX_MEDIA) {
      throw new BadRequestException(`Ko'pi bilan ${this.config.env.ORDER_MAX_MEDIA} ta fayl yuklash mumkin`);
    }

    const isPhoto = file.mime in PHOTO_MIMES;
    const isVideo = file.mime in VIDEO_MIMES;
    if (!isPhoto && !isVideo) {
      throw new UnsupportedMediaTypeException('Faqat rasm (JPEG/PNG/WebP/HEIC) yoki video (MP4/MOV/WebM)');
    }
    // The client-declared Content-Type is only a label — verify the actual
    // file bytes match it before trusting it for storage/serving. See
    // infra/storage/magic-bytes.ts for why this matters even with the
    // allow-list + nosniff header already in place.
    if (!matchesMagicBytes(file.buffer, file.mime)) {
      throw new UnsupportedMediaTypeException("Fayl mazmuni e'lon qilingan turga mos kelmadi");
    }
    const maxBytes = (isPhoto ? this.config.env.UPLOAD_MAX_PHOTO_MB : this.config.env.UPLOAD_MAX_VIDEO_MB) * 1024 * 1024;
    if (file.buffer.length > maxBytes) {
      throw new PayloadTooLargeException(
        `Fayl juda katta (maksimum ${isPhoto ? this.config.env.UPLOAD_MAX_PHOTO_MB : this.config.env.UPLOAD_MAX_VIDEO_MB} MB)`,
      );
    }

    const ext = isPhoto ? PHOTO_MIMES[file.mime]! : VIDEO_MIMES[file.mime]!;
    const { objectKey } = await this.storage.save(file.buffer, { mime: file.mime, ext });

    await this.prisma.orderMedia.create({
      data: {
        orderId: order.id,
        kind: isPhoto ? 'PHOTO' : 'VIDEO',
        uploadedByRole,
        objectKey,
        mime: file.mime,
        sizeBytes: file.buffer.length,
      },
    });
  }

  async deleteMedia(customerId: string, orderId: string, mediaId: string): Promise<OrderDto> {
    const order = await this.getOwned(customerId, orderId);
    const media = order.media.find((m) => m.id === mediaId);
    if (!media) throw new NotFoundException('Media topilmadi');
    await this.prisma.orderMedia.delete({ where: { id: mediaId } });
    await this.storage.delete(media.objectKey);
    return this.toDto(await this.getOwned(customerId, orderId));
  }

  /** Streaming lookup for GET /media/:id (public-by-uuid, like a presigned URL). */
  async getMediaFile(mediaId: string) {
    const media = await this.prisma.orderMedia.findUnique({ where: { id: mediaId } });
    if (!media) throw new NotFoundException('Media topilmadi');
    return { stream: this.storage.createReadStream(media.objectKey), mime: media.mime };
  }

  // ─────────────── AI diagnosis + quote (DRAFT → PRICED) ───────────────

  async diagnose(customerId: string, orderId: string): Promise<OrderDto> {
    const order = await this.getOwned(customerId, orderId);
    if (!canTransition(order.status as OrderStatus, OrderStatus.PRICED)) {
      throw new ConflictException('Bu holatda tashxis qo‘yib bo‘lmaydi');
    }

    const categories = await this.prisma.serviceCategory.findMany({ where: { active: true } });
    const images = await this.loadAiImages(order.media);

    const diagnosis = await this.ai.diagnose({
      description: order.description,
      serviceTier: order.serviceTier,
      categories: categories.map((c) => ({ id: c.id, slug: c.slug, nameUz: c.nameUz })),
      currentCategoryId: order.categoryId,
      images,
    });

    // Category for pricing: customer's pick wins; else AI suggestion; else refuse.
    const categoryId = order.categoryId ?? diagnosis.suggestedCategoryId;
    if (!categoryId) {
      throw new BadRequestException('Xizmat turini tanlang — avtomatik aniqlab bo‘lmadi');
    }
    const category = categories.find((c) => c.id === categoryId);
    if (!category) throw new BadRequestException('Xizmat turi topilmadi');

    const quote = computeQuote(
      { min: category.basePriceMin, max: category.basePriceMax },
      diagnosis.complexity,
      order.serviceTier,
    );

    const aiDiagnosis: AiDiagnosisDto = {
      issueSummary: diagnosis.issueSummary,
      suggestedCategoryId: diagnosis.suggestedCategoryId,
      suggestedCategorySlug: diagnosis.suggestedCategorySlug,
      complexity: diagnosis.complexity,
      confidence: diagnosis.confidence,
      source: diagnosis.source,
      promptVersion: diagnosis.promptVersion,
    };

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        categoryId,
        complexity: diagnosis.complexity,
        aiDiagnosis: aiDiagnosis as unknown as Prisma.InputJsonValue,
        priceMin: quote.priceMin,
        priceMax: quote.priceMax,
        platformFee: quote.platformFee,
        status: OrderStatus.PRICED,
        statusHistory: {
          create: {
            fromStatus: order.status,
            toStatus: OrderStatus.PRICED,
            actorId: customerId,
            note: `ai:${diagnosis.source}`,
          },
        },
      },
      include: FULL_INCLUDE,
    });
    return this.toDto(updated);
  }

  // ─────────────── Submit (PRICED → SEARCHING) & cancel ───────────────

  async submit(customerId: string, orderId: string): Promise<OrderDto> {
    const order = await this.getOwned(customerId, orderId);
    if (!canTransition(order.status as OrderStatus, OrderStatus.SEARCHING)) {
      throw new ConflictException('Avval narx taklifini oling (tashxis)');
    }
    if (!order.addressText && (order.latitude == null || order.longitude == null)) {
      throw new BadRequestException('Manzilni kiriting yoki joylashuvni aniqlang');
    }
    if (order.serviceTier === 'SCHEDULED') {
      if (!order.scheduledAt) throw new BadRequestException('Sana va vaqtni tanlang');
      this.assertSchedulable(order.scheduledAt);
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.SEARCHING,
        consentAcceptedAt: new Date(),
        submittedAt: new Date(),
        // PRIORITY/EMERGENCY are ASAP — clear any stale slot.
        ...(order.serviceTier !== 'SCHEDULED' ? { scheduledAt: null } : {}),
        statusHistory: {
          create: {
            fromStatus: order.status,
            toStatus: OrderStatus.SEARCHING,
            actorId: customerId,
          },
        },
      },
      include: FULL_INCLUDE,
    });
    // Fire-and-forget from the caller's perspective — dispatch runs its own
    // cascade/notifications independently; a slow/failed first cascade step
    // must not fail the customer's submit request. Errors are logged inside
    // DispatchService itself (cascadeNext no-ops safely on any bad state).
    void this.dispatch.startDispatch(order.id).catch((err: unknown) => {
      this.logger.error(`startDispatch failed for order ${order.id}: ${String(err)}`);
    });
    return this.toDto(updated);
  }

  async cancel(customerId: string, orderId: string): Promise<OrderDto> {
    const order = await this.getOwned(customerId, orderId);
    if (!canTransition(order.status as OrderStatus, OrderStatus.CANCELLED_BY_CUSTOMER)) {
      throw new ConflictException('Bu buyurtmani bekor qilib bo‘lmaydi');
    }
    // Guarded on order.status — a cancel can otherwise race
    // DispatchService.failSearch() (both read SEARCHING and can both pass
    // their own canTransition check) and end up writing two contradictory
    // statusHistory rows. Same CAS pattern as transitionByMaster/completeService.
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: { status: OrderStatus.CANCELLED_BY_CUSTOMER, cancelledAt: new Date() },
      });
      if (result.count !== 1) {
        throw new ConflictException('Bu buyurtmani bekor qilib bo‘lmaydi');
      }
      await tx.orderStatusHistory.create({
        data: { orderId, fromStatus: order.status, toStatus: OrderStatus.CANCELLED_BY_CUSTOMER, actorId: customerId },
      });
      return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: FULL_INCLUDE });
    });
    return this.toDto(updated);
  }

  // ─────────────── Job execution (M4) ───────────────

  /** Master heads to the job site. */
  async startEnRoute(masterId: string, orderId: string): Promise<OrderDto> {
    const order = await this.getOwnedByMaster(masterId, orderId);
    if (!canTransition(order.status as OrderStatus, OrderStatus.EN_ROUTE)) {
      throw new ConflictException("Bu holatda yo'lga chiqib bo'lmaydi");
    }
    const updated = await this.transitionByMaster(order, OrderStatus.EN_ROUTE, masterId);
    return this.toDto(updated);
  }

  /** Master starts the actual work at the customer's location. */
  async startService(masterId: string, orderId: string): Promise<OrderDto> {
    const order = await this.getOwnedByMaster(masterId, orderId);
    if (!canTransition(order.status as OrderStatus, OrderStatus.IN_PROGRESS)) {
      throw new ConflictException("Bu holatda ishni boshlab bo'lmaydi");
    }
    const updated = await this.transitionByMaster(order, OrderStatus.IN_PROGRESS, masterId);
    return this.toDto(updated);
  }

  /** Master marks the job done, recording the actual agreed price (within the quoted range). */
  async completeService(masterId: string, orderId: string, finalAmount: number): Promise<OrderDto> {
    const order = await this.getOwnedByMaster(masterId, orderId);
    if (!canTransition(order.status as OrderStatus, OrderStatus.COMPLETED)) {
      throw new ConflictException("Bu holatda ishni tugallab bo'lmaydi");
    }
    if (order.priceMin != null && order.priceMax != null) {
      if (finalAmount < order.priceMin || finalAmount > order.priceMax) {
        throw new BadRequestException(
          `Yakuniy narx ${order.priceMin}–${order.priceMax} so'm oralig'ida bo'lishi kerak`,
        );
      }
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      // Guarded on order.status so a double-tap "complete" can't both write
      // (see transitionByMaster's doc comment for why this pattern, not FOR UPDATE).
      const result = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: { status: OrderStatus.COMPLETED, finalAmount },
      });
      if (result.count !== 1) {
        throw new ConflictException("Bu holatda ishni tugallab bo'lmaydi");
      }
      await tx.orderStatusHistory.create({
        data: { orderId, fromStatus: order.status, toStatus: OrderStatus.COMPLETED, actorId: masterId },
      });
      return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: FULL_INCLUDE });
    });
    this.realtime.emitToUser(order.customerId, 'order:updated', {
      orderId,
      status: OrderStatus.COMPLETED,
    });
    await this.notifications.notify(
      order.customerId,
      'ORDER_COMPLETED',
      'Ish tugallandi',
      "Usta ishni tugallandi deb belgiladi. To'lov va tasdiqlash uchun buyurtmani ko'ring.",
      { orderId },
    );
    return this.toDto(updated);
  }

  /**
   * Customer confirms the completed job — the one transition into CLOSED.
   * Increments the master's jobsDone here (not at COMPLETED) since this is
   * the customer-confirmed signal, not just the master's own self-report.
   */
  async confirmCompletion(customerId: string, orderId: string): Promise<OrderDto> {
    const order = await this.getOwned(customerId, orderId);
    if (!canTransition(order.status as OrderStatus, OrderStatus.CLOSED)) {
      throw new ConflictException("Bu buyurtmani hali tasdiqlab bo'lmaydi");
    }
    if (!order.masterId) throw new ConflictException('Buyurtmaga usta tayinlanmagan');

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: { status: OrderStatus.CLOSED },
      });
      if (result.count !== 1) {
        throw new ConflictException("Bu buyurtmani hali tasdiqlab bo'lmaydi");
      }
      await tx.orderStatusHistory.create({
        data: { orderId, fromStatus: order.status, toStatus: OrderStatus.CLOSED, actorId: customerId },
      });
      await tx.masterProfile.update({
        where: { userId: order.masterId! },
        data: { jobsDone: { increment: 1 } },
      });
      return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: FULL_INCLUDE });
    });

    this.realtime.emitToUser(order.masterId, 'order:updated', { orderId, status: OrderStatus.CLOSED });
    await this.notifications.notify(
      order.masterId,
      'ORDER_CLOSED',
      'Mijoz tasdiqladi',
      'Mijoz ishni qabul qildi va yopdi.',
      { orderId },
    );
    // Batch 2: jobsDone just changed — recompute trust now that it's real.
    await this.trust.recomputeTrustTier(order.masterId);
    return this.toDto(updated);
  }

  /**
   * Master backs out of an ASSIGNED/EN_ROUTE job (Batch 2 — previously
   * unreachable; the penalty engine's primary trigger needs this to be a
   * real action). Always penalized — cancelling is never cost-free for the
   * master, though it never auto-bans (see PenaltiesService).
   */
  async cancelByMaster(masterId: string, orderId: string, reason?: string): Promise<OrderDto> {
    const order = await this.getOwnedByMaster(masterId, orderId);
    if (!canTransition(order.status as OrderStatus, OrderStatus.CANCELLED_BY_MASTER)) {
      throw new ConflictException("Bu holatda buyurtmani bekor qilib bo'lmaydi");
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: { status: OrderStatus.CANCELLED_BY_MASTER, cancelledAt: new Date() },
      });
      if (result.count !== 1) {
        throw new ConflictException("Bu holatda buyurtmani bekor qilib bo'lmaydi");
      }
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: OrderStatus.CANCELLED_BY_MASTER,
          actorId: masterId,
          note: reason,
        },
      });
      return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: FULL_INCLUDE });
    });

    this.realtime.emitToUser(order.customerId, 'order:updated', {
      orderId,
      status: OrderStatus.CANCELLED_BY_MASTER,
    });
    await this.notifications.notify(
      order.customerId,
      'ORDER_CANCELLED_BY_MASTER',
      'Usta bekor qildi',
      "Afsuski, tayinlangan usta buyurtmani bekor qildi. Qo'llab-quvvatlash bilan bog'laning.",
      { orderId },
    );
    await this.penalties.recordEvent(masterId, 'CANCELLATION', orderId, reason);
    return this.toDto(updated);
  }

  /** Master's own resolved (completed/closed) jobs, newest first (M4 job history). */
  async getJobHistory(masterId: string, cursor?: string): Promise<OrderListPage> {
    const take = 20;
    const rows = await this.prisma.order.findMany({
      where: { masterId, status: { in: [OrderStatus.COMPLETED, OrderStatus.CLOSED] } },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: FULL_INCLUDE,
    });
    const items = rows.slice(0, take).map((r) => this.toDto(r));
    return { items, nextCursor: rows.length > take ? rows[take]!.id : null };
  }

  // ─────────────── Read ───────────────

  async list(customerId: string, cursor?: string, status?: OrderStatus): Promise<OrderListPage> {
    const take = 20;
    const rows = await this.prisma.order.findMany({
      where: { customerId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: FULL_INCLUDE,
    });
    const items = rows.slice(0, take).map((r) => this.toDto(r));
    return { items, nextCursor: rows.length > take ? rows[take]!.id : null };
  }

  async getOne(customerId: string, orderId: string): Promise<OrderDto> {
    return this.toDto(await this.getOwned(customerId, orderId));
  }

  /** The one order currently on this master's plate, through its whole active lifecycle (M3+M4). */
  async getCurrentJob(masterId: string): Promise<OrderDto | null> {
    const order = await this.prisma.order.findFirst({
      where: { masterId, status: { in: ACTIVE_MASTER_JOB_STATUSES as OrderStatus[] } },
      include: FULL_INCLUDE,
    });
    return order ? this.toDto(order) : null;
  }

  // ─────────────── helpers ───────────────

  private async getOwned(customerId: string, orderId: string): Promise<OrderWithRelations> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: FULL_INCLUDE,
    });
    if (!order) throw new NotFoundException('Buyurtma topilmadi');
    if (order.customerId !== customerId) throw new ForbiddenException("Ruxsat yo'q");
    return order;
  }

  private async getOwnedByMaster(masterId: string, orderId: string): Promise<OrderWithRelations> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: FULL_INCLUDE,
    });
    if (!order) throw new NotFoundException('Buyurtma topilmadi');
    if (order.masterId !== masterId) throw new ForbiddenException("Ruxsat yo'q");
    return order;
  }

  /**
   * Guarded transition: the update is conditioned on the order still being in
   * `order.status` (the value we read it at), so two concurrent calls (e.g. a
   * double-tap on "en route"/"start") can't both succeed and both write a
   * statusHistory row — the second sees `count === 0` and is rejected as a
   * conflict, same class of fix as the accept-race lock (M3) and refresh-token
   * rotation race (pre-M4 audit), just via a guarded update instead of
   * `SELECT ... FOR UPDATE` since there's only ever one legitimate writer
   * (the assigned master) racing against their own duplicate request.
   */
  private async transitionByMaster(
    order: OrderWithRelations,
    toStatus: OrderStatus,
    masterId: string,
  ): Promise<OrderWithRelations> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: { status: toStatus },
      });
      if (result.count !== 1) {
        throw new ConflictException("Bu holatda amalni bajarib bo'lmaydi");
      }
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, fromStatus: order.status, toStatus, actorId: masterId },
      });
      return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: FULL_INCLUDE });
    });
    this.realtime.emitToUser(order.customerId, 'order:updated', { orderId: order.id, status: toStatus });
    return updated;
  }

  private async assertCategory(categoryId: string): Promise<void> {
    const found = await this.prisma.serviceCategory.findFirst({
      where: { id: categoryId, active: true },
    });
    if (!found) throw new BadRequestException("Xizmat turi noto'g'ri");
  }

  private assertSchedulable(when: Date): void {
    const now = Date.now();
    const max = now + ORDER_MAX_DAYS_AHEAD * 86_400_000;
    if (when.getTime() <= now) throw new BadRequestException("O'tgan vaqtni tanlab bo'lmaydi");
    if (when.getTime() > max) {
      throw new BadRequestException(`Ko'pi bilan ${ORDER_MAX_DAYS_AHEAD} kun oldindan band qilish mumkin`);
    }
    // UZ is a fixed UTC+5 offset (no DST) — compare in Tashkent wall-clock
    // terms via UTC-only math, independent of the server process's own timezone.
    const { slot } = utcIsoToSlot(when.toISOString());
    if (!(ORDER_TIME_SLOTS as readonly string[]).includes(slot)) {
      throw new BadRequestException(`Vaqt oralig'i: ${ORDER_TIME_SLOTS.join(', ')}`);
    }
  }

  private async loadAiImages(media: OrderMedia[]): Promise<DiagnoseImage[]> {
    const photos = media
      .filter((m) => m.kind === 'PHOTO' && AI_MIMES.has(m.mime) && m.sizeBytes <= AI_MAX_IMAGE_BYTES)
      .slice(0, AI_MAX_IMAGES);
    const images: DiagnoseImage[] = [];
    for (const p of photos) {
      try {
        const buf = await this.storage.read(p.objectKey);
        images.push({ mediaType: p.mime as DiagnoseImage['mediaType'], base64: buf.toString('base64') });
      } catch {
        // Missing file must not block diagnosis.
      }
    }
    return images;
  }

  private toDto(order: OrderWithRelations): OrderDto {
    return {
      id: order.id,
      orderNo: order.orderNo,
      status: order.status as OrderDto['status'],
      serviceTier: order.serviceTier as OrderDto['serviceTier'],
      categoryId: order.categoryId,
      categoryName: order.category?.nameUz ?? null,
      description: order.description,
      scheduledAt: order.scheduledAt?.toISOString() ?? null,
      addressText: order.addressText,
      latitude: order.latitude == null ? null : Number(order.latitude),
      longitude: order.longitude == null ? null : Number(order.longitude),
      complexity: (order.complexity as OrderDto['complexity']) ?? null,
      aiDiagnosis: (order.aiDiagnosis as unknown as AiDiagnosisDto) ?? null,
      priceMin: order.priceMin,
      priceMax: order.priceMax,
      platformFee: order.platformFee,
      finalAmount: order.finalAmount,
      media: order.media.map((m) => ({
        id: m.id,
        kind: m.kind as 'PHOTO' | 'VIDEO',
        uploadedByRole: m.uploadedByRole as 'CUSTOMER' | 'MASTER',
        url: `/api/v1/media/${m.id}`,
        mime: m.mime,
        sizeBytes: m.sizeBytes,
      })),
      history: order.statusHistory.map((h) => ({
        fromStatus: (h.fromStatus as OrderDto['status']) ?? null,
        toStatus: h.toStatus as OrderDto['status'],
        createdAt: h.createdAt.toISOString(),
      })),
      master: order.master
        ? {
            id: order.master.userId,
            fullName: order.master.fullName,
            phone: order.master.user.phone,
            ratingAvg: Number(order.master.ratingAvg),
            jobsDone: order.master.jobsDone,
          }
        : null,
      // Only reaches the customer's own view (redundant there — see the
      // frontend's rendering choice) once the master's view of this same
      // shared OrderDto also becomes populated: both sides see contact info
      // starting at ASSIGNED, never before.
      customer: order.masterId
        ? {
            id: order.customer.id,
            fullName: order.customer.customerProfile?.fullName ?? null,
            phone: order.customer.phone,
          }
        : null,
      createdAt: order.createdAt.toISOString(),
      submittedAt: order.submittedAt?.toISOString() ?? null,
    };
  }
}
