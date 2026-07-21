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

  /**
   * Atomically validate-and-revoke a refresh token in one transaction, using
   * SELECT ... FOR UPDATE to serialize concurrent refreshes of the *same*
   * raw token — the same race-safety pattern as DispatchService.acceptOffer.
   * Without this, two concurrent /auth/refresh calls with the same token
   * could both pass validation before either revoked, minting two live
   * sessions from what's supposed to be a single-use token.
   */
  async consumeSession(rawRefresh: string): Promise<{ id: string; userId: string }> {
    const hash = this.hashRefresh(rawRefresh);
    const invalid = (): never => {
      throw new UnauthorizedException('Sessiya yaroqsiz yoki muddati tugagan');
    };

    const existing = await this.prisma.session.findFirst({
      where: { refreshTokenHash: hash },
      select: { id: true },
    });
    if (!existing) return invalid();

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM sessions WHERE id = ${existing.id}::uuid FOR UPDATE`;
      const session = await tx.session.findFirst({
        where: { id: existing.id, revokedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true, userId: true },
      });
      if (!session) return invalid();
      await tx.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      return session;
    });
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
