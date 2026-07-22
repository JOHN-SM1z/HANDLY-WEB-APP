import { Injectable } from '@nestjs/common';
import type { AuditLogEntryDto, AuditLogPage } from '@handly/contracts';
import type { AuditLog, Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * Append-only audit trail for admin mutations (Batch 3). Deliberately called
 * from the admin controller layer, not from Batch 1/2 services — keeps this
 * additive rather than reaching back into already-shipped code.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    actorId: string,
    action: string,
    entityType: string,
    entityId?: string,
    before?: unknown,
    after?: unknown,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        entityType,
        entityId,
        before: before === undefined ? undefined : (before as Prisma.InputJsonValue),
        after: after === undefined ? undefined : (after as Prisma.InputJsonValue),
      },
    });
  }

  async list(cursor?: string, actorId?: string, entityType?: string): Promise<AuditLogPage> {
    const take = 30;
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...(actorId ? { actorId } : {}),
        ...(entityType ? { entityType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const items = rows.slice(0, take).map((r) => this.toDto(r));
    return { items, nextCursor: rows.length > take ? rows[take]!.id : null };
  }

  private toDto(r: AuditLog): AuditLogEntryDto {
    return {
      id: r.id,
      actorId: r.actorId,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      before: r.before,
      after: r.after,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
