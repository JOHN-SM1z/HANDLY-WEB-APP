import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AdminUserDetailDto, AdminUserListItemDto, AdminUserListPage } from '@handly/contracts';
import type { CustomerProfile, MasterProfile, MasterSubscription, User } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PenaltiesService } from '../penalties/penalties.service';
import { TrustService } from '../trust/trust.service';

type UserRow = User & {
  customerProfile: CustomerProfile | null;
  masterProfile: (MasterProfile & { subscription: MasterSubscription | null }) | null;
};

const INCLUDE = { customerProfile: true, masterProfile: { include: { subscription: true } } } as const;

interface ListFilters {
  cursor?: string;
  phone?: string;
  role?: 'CUSTOMER' | 'MASTER' | 'ADMIN';
  status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  verificationStatus?: string;
  trustTier?: number;
  subscriptionPlan?: 'FREE' | 'PREMIUM';
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly penalties: PenaltiesService,
    private readonly trust: TrustService,
  ) {}

  async list(filters: ListFilters): Promise<AdminUserListPage> {
    const take = 30;
    // Master-scoped filters (verificationStatus/trustTier/subscriptionPlan) only make
    // sense combined with role=MASTER — applying them without that would silently
    // exclude every customer/admin row instead of returning an honest empty set, so
    // if any of them is set, role is forced to MASTER regardless of what was passed.
    const masterFilterActive = Boolean(
      filters.verificationStatus || filters.trustTier !== undefined || filters.subscriptionPlan,
    );
    const role = masterFilterActive ? 'MASTER' : filters.role;

    const rows = await this.prisma.user.findMany({
      where: {
        ...(filters.phone ? { phone: { contains: filters.phone } } : {}),
        ...(role ? { role } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(masterFilterActive
          ? {
              masterProfile: {
                ...(filters.verificationStatus ? { verificationStatus: filters.verificationStatus as never } : {}),
                ...(filters.trustTier !== undefined ? { trustTier: filters.trustTier } : {}),
                ...(filters.subscriptionPlan === 'PREMIUM' ? { subscription: { isNot: null } } : {}),
                ...(filters.subscriptionPlan === 'FREE' ? { subscription: { is: null } } : {}),
              },
            }
          : {}),
      },
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });
    const items = rows.slice(0, take).map((r) => this.toListDto(r));
    return { items, nextCursor: rows.length > take ? rows[take]!.id : null };
  }

  async detail(id: string): Promise<AdminUserDetailDto> {
    const row = await this.prisma.user.findUnique({ where: { id }, include: INCLUDE });
    if (!row) throw new NotFoundException('Foydalanuvchi topilmadi');

    const [ordersCount, penaltyHistory, liveTrust] = await Promise.all([
      this.prisma.order.count({
        where: row.role === 'MASTER' ? { masterId: id } : { customerId: id },
      }),
      row.role === 'MASTER' ? this.penalties.getHistory(id) : Promise.resolve(null),
      // MasterProfile.trustTier only persists at specific trigger points (job
      // close, review, penalty — see TrustService.recomputeTrustTier's doc
      // comment); it does NOT update on verification decide. An admin acting
      // on this detail page needs the live score, not a column that can be
      // stale for arbitrarily long, so recompute (read-only, no persist) here.
      row.role === 'MASTER' ? this.trust.computeTrustScore(id) : Promise.resolve(null),
    ]);

    const listDto = this.toListDto(row);
    return {
      ...listDto,
      trustTier: liveTrust?.tier ?? listDto.trustTier,
      ordersCount,
      penaltyPoints: penaltyHistory?.activePoints ?? null,
    };
  }

  /**
   * Idempotent: suspending an already-SUSPENDED user is a safe no-op (still
   * audit-logged as an attempted action). Blocks suspending an ADMIN account
   * or the acting admin's own account — the privilege-escalation/lockout guard.
   */
  async suspend(targetId: string, adminId: string, reason: string): Promise<AdminUserDetailDto> {
    if (targetId === adminId) {
      throw new ForbiddenException("O'zingizni bloklay olmaysiz");
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('Foydalanuvchi topilmadi');
    if (target.role === 'ADMIN') {
      throw new ForbiddenException('Administrator hisobini bloklab bo\'lmaydi');
    }

    const result = await this.prisma.user.updateMany({
      where: { id: targetId, status: { not: 'SUSPENDED' } },
      data: { status: 'SUSPENDED' },
    });
    await this.audit.record(
      adminId,
      'USER_SUSPEND',
      'User',
      targetId,
      { status: target.status },
      { status: 'SUSPENDED', reason, alreadySuspended: result.count === 0 },
    );
    return this.detail(targetId);
  }

  /** Idempotent: restoring a non-suspended user is a safe no-op. */
  async restore(targetId: string, adminId: string): Promise<AdminUserDetailDto> {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('Foydalanuvchi topilmadi');

    const result = await this.prisma.user.updateMany({
      where: { id: targetId, status: 'SUSPENDED' },
      data: { status: 'ACTIVE' },
    });
    await this.audit.record(
      adminId,
      'USER_RESTORE',
      'User',
      targetId,
      { status: target.status },
      { status: 'ACTIVE', wasAlreadyActive: result.count === 0 },
    );
    return this.detail(targetId);
  }

  private toListDto(row: UserRow): AdminUserListItemDto {
    return {
      id: row.id,
      phone: row.phone,
      role: row.role as AdminUserListItemDto['role'],
      status: row.status as AdminUserListItemDto['status'],
      fullName: row.masterProfile?.fullName ?? row.customerProfile?.fullName ?? null,
      createdAt: row.createdAt.toISOString(),
      verificationStatus: row.masterProfile?.verificationStatus ?? null,
      trustTier: row.masterProfile?.trustTier ?? null,
      ratingAvg: row.masterProfile ? Number(row.masterProfile.ratingAvg) : null,
      jobsDone: row.masterProfile?.jobsDone ?? null,
      subscriptionPlan: row.masterProfile ? (row.masterProfile.subscription ? 'PREMIUM' : 'FREE') : null,
    };
  }
}
