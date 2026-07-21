import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../../common/auth/auth-user';

const userRoom = (userId: string): string => `user:${userId}`;

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

  constructor(private readonly jwt: JwtService) {}

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
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(userRoom(userId)).emit(event, payload);
  }
}
