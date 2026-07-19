import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthTokens } from '@handly/contracts';
import type { AuthUser, JwtPayload } from '../../common/auth/auth-user';
import { parseDurationSeconds } from '../../common/util/duration';
import { AppConfig } from '../../infra/config/app-config';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  private hashRefresh(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /** Sign a fresh access token and create a new rotating refresh session. */
  async issue(claims: AuthUser, meta: SessionMeta = {}): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: claims.id,
      role: claims.role,
      status: claims.status,
      verificationStatus: claims.verificationStatus,
    };
    const expiresIn = parseDurationSeconds(this.config.env.JWT_ACCESS_TTL);
    const accessToken = await this.jwt.signAsync(payload, { expiresIn });

    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(
      Date.now() + this.config.env.JWT_REFRESH_TTL_DAYS * 86_400 * 1000,
    );
    await this.prisma.session.create({
      data: {
        userId: claims.id,
        refreshTokenHash: this.hashRefresh(refreshToken),
        userAgent: meta.userAgent,
        ip: meta.ip,
        expiresAt,
      },
    });

    return { accessToken, refreshToken, expiresIn };
  }

  async findValidSession(rawRefresh: string): Promise<{ id: string; userId: string }> {
    const session = await this.prisma.session.findFirst({
      where: {
        refreshTokenHash: this.hashRefresh(rawRefresh),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, userId: true },
    });
    if (!session) throw new UnauthorizedException('Sessiya yaroqsiz yoki muddati tugagan');
    return session;
  }

  async revokeById(id: string): Promise<void> {
    await this.prisma.session
      .update({ where: { id }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
  }

  async revokeByToken(rawRefresh: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: this.hashRefresh(rawRefresh), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
