import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { NotificationDto, NotificationListPage, NotificationType } from '@handly/contracts';
import type { Notification, Prisma } from '@prisma/client';
import { PushService } from '../../infra/push/push.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

type Tx = Prisma.TransactionClient;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * Just the DB write — pass the caller's `tx` so the notification record
   * commits atomically with whatever state change it's documenting (e.g.
   * dispatch's accept transaction). Never call deliver() until that
   * transaction has actually committed (see notify() below for the common
   * non-transactional case).
   */
  async createRecord(
    db: Tx | PrismaService,
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<Notification> {
    return db.notification.create({
      data: { userId, type, title, body, data: data as unknown as Prisma.InputJsonValue },
    });
  }

  /** Best-effort push + socket delivery for an already-committed notification. */
  deliver(notification: Notification): void {
    this.realtime.emitToUser(notification.userId, 'notification:new', this.toDto(notification));
    void this.prisma.device
      .findMany({ where: { userId: notification.userId }, select: { pushToken: true } })
      .then((devices) =>
        this.push.send(
          devices.map((d) => d.pushToken),
          {
            title: notification.title,
            body: notification.body,
            data: notification.data ? stringifyValues(notification.data as Record<string, unknown>) : undefined,
          },
        ),
      )
      .catch(() => undefined);
  }

  /** Convenience wrapper for call sites with no existing transaction — create + deliver together. */
  async notify(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<Notification> {
    const notification = await this.createRecord(this.prisma, userId, type, title, body, data);
    this.deliver(notification);
    return notification;
  }

  async list(userId: string, cursor?: string): Promise<NotificationListPage> {
    const take = 20;
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const items = rows.slice(0, take).map((r) => this.toDto(r));
    return { items, nextCursor: rows.length > take ? rows[take]!.id : null };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string): Promise<NotificationDto> {
    const existing = await this.prisma.notification.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Bildirishnoma topilmadi');
    if (existing.userId !== userId) throw new ForbiddenException("Ruxsat yo'q");
    if (existing.readAt) return this.toDto(existing);
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return this.toDto(updated);
  }

  private toDto(n: Notification): NotificationDto {
    return {
      id: n.id,
      type: n.type as NotificationDto['type'],
      title: n.title,
      body: n.body,
      data: (n.data as Record<string, unknown> | null) ?? null,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    };
  }
}

function stringifyValues(data: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]));
}
