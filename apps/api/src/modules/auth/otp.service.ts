import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import * as argon2 from 'argon2';
import type { OtpPurpose } from '@handly/contracts';
import { AppConfig } from '../../infra/config/app-config';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';
import { SMS_PROVIDER, type SmsProvider } from './sms/sms-provider';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: AppConfig,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  /** Generate, persist (hashed), and send a 6-digit code. Returns resend cooldown seconds. */
  async issue(phone: string, purpose: OtpPurpose): Promise<number> {
    const { OTP_TTL_SECONDS, OTP_RESEND_COOLDOWN_SECONDS, OTP_DAILY_CAP_PER_PHONE } =
      this.config.env;

    await this.enforceRateLimits(phone, purpose, OTP_RESEND_COOLDOWN_SECONDS, OTP_DAILY_CAP_PER_PHONE);

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = await argon2.hash(code, { type: argon2.argon2id });

    await this.prisma.otpCode.deleteMany({ where: { phone, purpose, usedAt: null } });
    await this.prisma.otpCode.create({
      data: {
        phone,
        purpose,
        codeHash,
        expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
      },
    });

    await this.sms.sendOtp(phone, code);
    return OTP_RESEND_COOLDOWN_SECONDS;
  }

  /** Verify a code; consumes it on success, increments attempts on failure. */
  async verify(phone: string, code: string, purpose: OtpPurpose): Promise<void> {
    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, purpose, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new BadRequestException('Kod topilmadi yoki muddati tugagan');
    if (otp.attempts >= this.config.env.OTP_MAX_ATTEMPTS) {
      throw new BadRequestException("Urinishlar soni tugadi. Yangi kod so'rang");
    }

    const ok = await argon2.verify(otp.codeHash, code);
    if (!ok) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException("Kod noto'g'ri");
    }

    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
  }

  private async enforceRateLimits(
    phone: string,
    purpose: OtpPurpose,
    cooldown: number,
    dailyCap: number,
  ): Promise<void> {
    const cooldownKey = `otp:cooldown:${purpose}:${phone}`;
    try {
      const fresh = await this.redis.setNx(cooldownKey, '1', cooldown);
      if (!fresh) {
        const remaining = await this.redis.ttl(cooldownKey);
        throw new BadRequestException(
          `Kodni ${remaining > 0 ? remaining : cooldown} soniyadan so'ng qayta yuboring`,
        );
      }
      const count = await this.redis.incrWithTtl(`otp:daily:${phone}`, 86400);
      if (count > dailyCap) {
        throw new BadRequestException("Kunlik SMS chegarasi tugadi. Ertaga urinib ko'ring");
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      // Fail open if Redis is unavailable so dev isn't blocked; logged for visibility.
      this.logger.warn(`Rate-limit check skipped (Redis): ${(err as Error).message}`);
    }
  }
}
