import '@fastify/cookie'; // pull in setCookie/clearCookie + request.cookies typings
import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  loginSchema,
  otpRequestSchema,
  otpVerifySchema,
  passwordResetSchema,
  registerSchema,
  uzPhoneSchema,
} from '@handly/contracts';
import { Public } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { AppConfig } from '../../infra/config/app-config';
import { AuthService } from './auth.service';
import type { SessionMeta } from './token.service';

const REFRESH_COOKIE = 'handly_rt';
const REFRESH_PATH = '/api/v1/auth';
const requestResetSchema = z.object({ phone: uzPhoneSchema });

@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfig,
  ) {}

  @Post('register')
  register(@Body(new ZodValidationPipe(registerSchema)) dto: z.infer<typeof registerSchema>) {
    return this.auth.register(dto);
  }

  @Post('otp/verify')
  @HttpCode(200)
  async verifyOtp(
    @Body(new ZodValidationPipe(otpVerifySchema)) dto: z.infer<typeof otpVerifySchema>,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.auth.verifyOtp(dto, this.meta(req));
    this.setRefreshCookie(reply, result.tokens.refreshToken);
    return result;
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: z.infer<typeof loginSchema>,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const outcome = await this.auth.login(dto, this.meta(req));
    if ('tokens' in outcome) this.setRefreshCookie(reply, outcome.tokens.refreshToken);
    return outcome;
  }

  @Post('otp/request')
  @HttpCode(200)
  requestOtp(@Body(new ZodValidationPipe(otpRequestSchema)) dto: z.infer<typeof otpRequestSchema>) {
    return this.auth.requestOtp(dto.phone, dto.purpose);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const raw =
      req.cookies?.[REFRESH_COOKIE] ??
      (typeof req.body === 'object' && req.body
        ? (req.body as { refreshToken?: string }).refreshToken
        : undefined);
    if (!raw) throw new UnauthorizedException("Refresh token yo'q");

    const result = await this.auth.refresh(raw, this.meta(req));
    this.setRefreshCookie(reply, result.tokens.refreshToken);
    return result;
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_PATH });
    return { success: true };
  }

  @Post('password/request-reset')
  @HttpCode(200)
  requestReset(@Body(new ZodValidationPipe(requestResetSchema)) dto: z.infer<typeof requestResetSchema>) {
    return this.auth.requestPasswordReset(dto.phone);
  }

  @Post('password/reset')
  @HttpCode(200)
  resetPassword(
    @Body(new ZodValidationPipe(passwordResetSchema)) dto: z.infer<typeof passwordResetSchema>,
  ) {
    return this.auth.resetPassword(dto);
  }

  // ── helpers ──
  private meta(req: FastifyRequest): SessionMeta {
    return { userAgent: req.headers['user-agent'], ip: req.ip };
  }

  private setRefreshCookie(reply: FastifyReply, token: string): void {
    reply.setCookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.config.isProd,
      sameSite: 'lax',
      path: REFRESH_PATH,
      maxAge: this.config.env.JWT_REFRESH_TTL_DAYS * 86_400,
    });
  }
}
