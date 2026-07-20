import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
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
} from '@handly/contracts';
import { AppConfig } from '../../infra/config/app-config';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { STORAGE_PROVIDER, type StorageProvider } from '../../infra/storage/storage-provider';
import { AiService } from '../ai/ai.service';
import type { DiagnoseImage } from '../ai/ai-provider';
import { canTransition, EDITABLE_STATUSES } from './order-state';
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
};

const FULL_INCLUDE = {
  category: true,
  media: { orderBy: { createdAt: 'asc' as const } },
  statusHistory: { orderBy: { createdAt: 'asc' as const } },
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly ai: AiService,
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
    if (order.media.length >= this.config.env.ORDER_MAX_MEDIA) {
      throw new BadRequestException(`Ko'pi bilan ${this.config.env.ORDER_MAX_MEDIA} ta fayl yuklash mumkin`);
    }

    const isPhoto = file.mime in PHOTO_MIMES;
    const isVideo = file.mime in VIDEO_MIMES;
    if (!isPhoto && !isVideo) {
      throw new UnsupportedMediaTypeException('Faqat rasm (JPEG/PNG/WebP/HEIC) yoki video (MP4/MOV/WebM)');
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
        orderId,
        kind: isPhoto ? 'PHOTO' : 'VIDEO',
        objectKey,
        mime: file.mime,
        sizeBytes: file.buffer.length,
      },
    });
    return this.toDto(await this.getOwned(customerId, orderId));
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
    // Dispatch (matching, offers) begins in Milestone 3 — SEARCHING is terminal for M2.
    return this.toDto(updated);
  }

  async cancel(customerId: string, orderId: string): Promise<OrderDto> {
    const order = await this.getOwned(customerId, orderId);
    if (!canTransition(order.status as OrderStatus, OrderStatus.CANCELLED_BY_CUSTOMER)) {
      throw new ConflictException('Bu buyurtmani bekor qilib bo‘lmaydi');
    }
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED_BY_CUSTOMER,
        cancelledAt: new Date(),
        statusHistory: {
          create: {
            fromStatus: order.status,
            toStatus: OrderStatus.CANCELLED_BY_CUSTOMER,
            actorId: customerId,
          },
        },
      },
      include: FULL_INCLUDE,
    });
    return this.toDto(updated);
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
    const hhmm = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
    if (!(ORDER_TIME_SLOTS as readonly string[]).includes(hhmm)) {
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
      media: order.media.map((m) => ({
        id: m.id,
        kind: m.kind as 'PHOTO' | 'VIDEO',
        url: `/api/v1/media/${m.id}`,
        mime: m.mime,
        sizeBytes: m.sizeBytes,
      })),
      history: order.statusHistory.map((h) => ({
        fromStatus: (h.fromStatus as OrderDto['status']) ?? null,
        toStatus: h.toStatus as OrderDto['status'],
        createdAt: h.createdAt.toISOString(),
      })),
      createdAt: order.createdAt.toISOString(),
      submittedAt: order.submittedAt?.toISOString() ?? null,
    };
  }
}
