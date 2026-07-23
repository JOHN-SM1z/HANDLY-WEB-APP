import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { type LocationUpdatedEvent, locationUpdateInputSchema, OrderStatus } from '@handly/contracts';
import type { JwtPayload } from '../../common/auth/auth-user';
import { MetricsService } from '../../infra/metrics/metrics.service';
import { PrismaService } from '../../infra/prisma/prisma.service';

const userRoom = (userId: string): string => `user:${userId}`;

/**
 * Live GPS is meaningful once a master is actually assigned through job
 * completion — not before (still SEARCHING, no counterpart yet) and not
 * after CLOSED (job's over). Deliberately narrower than order-state.ts's
 * ACTIVE_MASTER_JOB_STATUSES (which also includes COMPLETED for "what's my
 * current job" purposes) since continuous location has no product value
 * once the master has already marked the work done.
 */
const LOCATION_TRACKING_STATUSES: OrderStatus[] = [
  OrderStatus.ASSIGNED,
  OrderStatus.EN_ROUTE,
  OrderStatus.IN_PROGRESS,
];

/**
 * Real-time push for dispatch/order events (M3). JWT-authed handshake reusing
 * the exact same access-token verification JwtAuthGuard uses for HTTP — no
 * duplicated auth logic. One room per user (`user:{id}`); other services
 * inject this gateway directly and call emitToUser() (no event bus — see
 * CLAUDE.md, M1/M2 never introduced one and a single-process modular
 * monolith doesn't need one for this).
 */
@WebSocketGateway({ namespace: '/ws' })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly metrics: MetricsService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      client.data.userId = payload.sub;
      await client.join(userRoom(payload.sub));
      this.metrics.socketConnections.inc();
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Socket disconnected: ${client.id}`);
    this.metrics.socketConnections.dec();
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(userRoom(userId)).emit(event, payload);
  }

  /**
   * Live GPS (both directions) — socket-only, never persisted. A client
   * (customer or master) emits its own coordinates; the server looks up
   * that user's one active order and relays to the other party's room.
   * No REST endpoint, no DB write — this is purely ephemeral relay, same
   * "no event bus, direct gateway call" shape the rest of this module uses.
   *
   * Raw Prisma read here (not via OrdersService) is deliberate: OrdersModule
   * already depends on RealtimeModule (to push order:updated), so the
   * reverse dependency would create a circular import. Same "admin reads
   * across module boundaries" precedent as AdminOrdersService/
   * AdminSupportService.
   */
  @SubscribeMessage('location:update')
  async handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const parsed = locationUpdateInputSchema.safeParse(body);
    if (!parsed.success) return;
    const userId = client.data.userId as string | undefined;
    if (!userId) return;

    const order = await this.prisma.order.findFirst({
      where: {
        status: { in: LOCATION_TRACKING_STATUSES },
        OR: [{ customerId: userId }, { masterId: userId }],
      },
      select: { id: true, customerId: true, masterId: true },
    });
    if (!order) return;

    const counterpartId = order.customerId === userId ? order.masterId : order.customerId;
    if (!counterpartId) return;

    const event: LocationUpdatedEvent = { orderId: order.id, lat: parsed.data.lat, lng: parsed.data.lng };
    this.emitToUser(counterpartId, 'location:updated', event);
  }
}
