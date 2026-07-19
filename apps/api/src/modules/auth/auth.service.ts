import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import type {
  AuthResult,
  LoginInput,
  OtpChallenge,
  OtpVerifyInput,
  PasswordResetInput,
  RegisterInput,
  Role,
  SessionUser,
} from '@handly/contracts';
import type { AuthUser } from '../../common/auth/auth-user';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OtpService } from './otp.service';
import { type SessionMeta, TokenService } from './token.service';

type UserWithMaster = Prisma.UserGetPayload<{ include: { masterProfile: true } }>;

/** Login succeeds with tokens, or bounces to phone verification for unverified accounts. */
export type LoginOutcome = AuthResult | (OtpChallenge & { needsVerification: true });

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly token: TokenService,
  ) {}

  async register(dto: RegisterInput): Promise<OtpChallenge> {
    const existing = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (existing && existing.status !== 'PENDING') {
      throw new ConflictException("Bu telefon raqami allaqachon ro'yxatdan o'tgan");
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    if (existing) {
      // Re-registration of an unverified account: refresh credentials and resend OTP.
      await this.prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, role: dto.role, locale: dto.locale },
      });
      await this.ensureProfile(existing.id, dto.role);
    } else {
      const referralCode = await this.uniqueReferralCode();
      const user = await this.prisma.user.create({
        data: {
          phone: dto.phone,
          passwordHash,
          role: dto.role,
          locale: dto.locale,
          referralCode,
          status: 'PENDING',
        },
      });
      await this.ensureProfile(user.id, dto.role);
    }

    const resendIn = await this.otp.issue(dto.phone, 'SIGNUP');
    return { otpSent: true, phone: dto.phone, resendIn };
  }

  async verifyOtp(dto: OtpVerifyInput, meta: SessionMeta): Promise<AuthResult> {
    await this.otp.verify(dto.phone, dto.code, dto.purpose);

    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      include: { masterProfile: true },
    });
    if (!user) throw new BadRequestException('Foydalanuvchi topilmadi');

    this.assertNotBlocked(user.status);

    let current = user;
    if (current.status === 'PENDING') {
      current = await this.prisma.user.update({
        where: { id: current.id },
        data: { status: 'ACTIVE' },
        include: { masterProfile: true },
      });
    }

    const tokens = await this.token.issue(this.claims(current), meta);
    return { user: this.sessionUser(current), tokens };
  }

  async login(dto: LoginInput, meta: SessionMeta): Promise<LoginOutcome> {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      include: { masterProfile: true },
    });
    // Generic message either way — no account enumeration.
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException("Telefon raqami yoki parol noto'g'ri");
    }

    this.assertNotBlocked(user.status);

    if (user.status === 'PENDING') {
      // Unverified account: bounce to phone verification instead of logging in.
      // ensureChallenge never throws on the resend cooldown — it reuses the
      // code already sent (or sends a fresh one) so the user isn't blocked.
      const resendIn = await this.otp.ensureChallenge(dto.phone, 'SIGNUP');
      return { otpSent: true, phone: dto.phone, resendIn, needsVerification: true };
    }

    const tokens = await this.token.issue(this.claims(user), meta);
    return { user: this.sessionUser(user), tokens };
  }

  async requestOtp(phone: string, purpose: OtpVerifyInput['purpose']): Promise<OtpChallenge> {
    const user = await this.prisma.user.findUnique({ where: { phone }, select: { id: true } });
    // Only actually send to known numbers, but always return a uniform challenge.
    if (user) {
      const resendIn = await this.otp.issue(phone, purpose);
      return { otpSent: true, phone, resendIn };
    }
    return { otpSent: true, phone, resendIn: 45 };
  }

  async refresh(rawRefresh: string, meta: SessionMeta): Promise<AuthResult> {
    const session = await this.token.findValidSession(rawRefresh);
    await this.token.revokeById(session.id); // single-use rotation

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      include: { masterProfile: true },
    });
    if (!user) throw new UnauthorizedException('Foydalanuvchi topilmadi');
    this.assertNotBlocked(user.status);

    const tokens = await this.token.issue(this.claims(user), meta);
    return { user: this.sessionUser(user), tokens };
  }

  async logout(rawRefresh: string | undefined): Promise<void> {
    if (rawRefresh) await this.token.revokeByToken(rawRefresh);
  }

  async requestPasswordReset(phone: string): Promise<OtpChallenge> {
    return this.requestOtp(phone, 'RESET');
  }

  async resetPassword(dto: PasswordResetInput): Promise<{ success: true }> {
    await this.otp.verify(dto.phone, dto.code, 'RESET');
    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user) throw new BadRequestException('Foydalanuvchi topilmadi');

    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await this.token.revokeAllForUser(user.id); // force re-login everywhere
    return { success: true };
  }

  // ── helpers ──
  private assertNotBlocked(status: string): void {
    if (status === 'BANNED' || status === 'SUSPENDED') {
      throw new ForbiddenException('Hisob bloklangan');
    }
  }

  private claims(user: UserWithMaster): AuthUser {
    return {
      id: user.id,
      role: user.role,
      status: user.status,
      verificationStatus: user.masterProfile?.verificationStatus,
    };
  }

  private sessionUser(user: UserWithMaster): SessionUser {
    return {
      id: user.id,
      phone: user.phone,
      role: user.role,
      status: user.status,
      locale: user.locale,
      verificationStatus: user.masterProfile?.verificationStatus,
    };
  }

  private async ensureProfile(userId: string, role: Role): Promise<void> {
    if (role === 'MASTER') {
      await this.prisma.masterProfile.upsert({ where: { userId }, update: {}, create: { userId } });
    } else {
      await this.prisma.customerProfile.upsert({
        where: { userId },
        update: {},
        create: { userId },
      });
    }
  }

  private async uniqueReferralCode(): Promise<string> {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 5; attempt++) {
      let code = '';
      for (const byte of randomBytes(8)) code += alphabet[byte % alphabet.length] ?? '';
      const clash = await this.prisma.user.findUnique({
        where: { referralCode: code },
        select: { referralCode: true },
      });
      if (!clash) return code;
    }
    return `H${Date.now().toString(36).toUpperCase()}`;
  }
}
