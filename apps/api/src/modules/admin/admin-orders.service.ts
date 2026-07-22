import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AdminOrderDetailDto,
  AdminOrderListItemDto,
  AdminOrderListPage,
  OrderStatus,
  ServiceTier,
} from '@handly/contracts';
import { PrismaService } from '../../infra/prisma/prisma.service';

interface ListFilters {
  cursor?: string;
  status?: OrderStatus;
  categoryId?: string;
  serviceTier?: ServiceTier;
  // Beta Blocker Sprint — "every order for this user," reachable from an
  // admin user-detail page or the support lookup tool.
  customerId?: string;
  masterId?: string;
  dateFrom?: string;
  dateTo?: string;
  lat?: number;
  lng?: number;
  radiusM?: number;
}

const LIST_INCLUDE = {
  category: { select: { nameUz: true } },
  customer: { select: { phone: true } },
  master: { include: { user: { select: { phone: true } } } },
} as const;

type ListRow = Prisma.OrderGetPayload<{ include: typeof LIST_INCLUDE }>;

@Injectable()
export class AdminOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters: ListFilters): Promise<AdminOrderListPage> {
    const take = 30;

    // Geo filter is a separate pre-pass (candidate id set) rather than one giant
    // raw-SQL query — orders.location needs ST_DWithin (Unsupported type, no
    // Prisma filter operator exists for it), everything else is a normal
    // Prisma predicate; combining via `id IN (...)` keeps this maintainable and
    // still lets the GIST index on orders.location do the geo narrowing.
    let geoOrderIds: string[] | undefined;
    if (filters.lat !== undefined && filters.lng !== undefined && filters.radiusM !== undefined) {
      const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM orders
        WHERE location IS NOT NULL
          AND ST_DWithin(
            location,
            ST_SetSRID(ST_MakePoint(${filters.lng}::float8, ${filters.lat}::float8), 4326)::geography,
            ${filters.radiusM}::float
          )
      `);
      geoOrderIds = rows.map((r) => r.id);
    }

    const rows = await this.prisma.order.findMany({
      where: {
        ...(geoOrderIds ? { id: { in: geoOrderIds } } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(filters.serviceTier ? { serviceTier: filters.serviceTier } : {}),
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
        ...(filters.masterId ? { masterId: filters.masterId } : {}),
        ...(filters.dateFrom || filters.dateTo
          ? {
              createdAt: {
                ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
                ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
              },
            }
          : {}),
      },
      include: LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });
    const items = rows.slice(0, take).map((r) => this.toListDto(r));
    return { items, nextCursor: rows.length > take ? rows[take]!.id : null };
  }

  async detail(id: string): Promise<AdminOrderDetailDto> {
    const row = await this.prisma.order.findUnique({
      where: { id },
      include: {
        ...LIST_INCLUDE,
        statusHistory: { orderBy: { createdAt: 'asc' } },
        dispatches: { orderBy: { offeredAt: 'asc' } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!row) throw new NotFoundException('Buyurtma topilmadi');

    return {
      ...this.toListDto(row),
      description: row.description,
      addressText: row.addressText,
      statusHistory: row.statusHistory.map((h) => ({
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        actorId: h.actorId,
        note: h.note,
        createdAt: h.createdAt.toISOString(),
      })),
      dispatches: row.dispatches.map((d) => ({
        masterId: d.masterId,
        status: d.status,
        distanceM: d.distanceM,
        offeredAt: d.offeredAt.toISOString(),
      })),
      payments: row.payments.map((p) => ({
        id: p.id,
        method: p.method,
        status: p.status,
        amount: p.amount,
        failureReason: p.failureReason,
        resolutionNote: p.resolutionNote,
        resolvedAt: p.resolvedAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  }

  private toListDto(row: ListRow): AdminOrderListItemDto {
    return {
      id: row.id,
      orderNo: row.orderNo,
      status: row.status,
      serviceTier: row.serviceTier,
      categoryNameUz: row.category?.nameUz ?? null,
      customerPhone: row.customer.phone,
      masterPhone: row.master?.user.phone ?? null,
      priceMin: row.priceMin,
      priceMax: row.priceMax,
      finalAmount: row.finalAmount,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
