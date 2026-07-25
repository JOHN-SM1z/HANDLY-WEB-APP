import { Body, Controller, Headers, HttpCode, HttpException, HttpStatus, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { paymentWebhookSchema } from '@handly/contracts';
import { Public } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { PaymentsService } from './payments.service';
import { ClickPaymentProvider } from '../../infra/payment/click-payment.provider';
import { AppConfig } from '../../infra/config/app-config';

/**
 * Public webhook for async provider confirmation (M5+). Supports both mock (sync)
 * and Click (async) payment providers.
 *
 * Mock provider: Settles synchronously inside `initiate()` — webhook path isn't
 * exercised in practice.
 *
 * Click provider: Calls /payments/webhook after customer confirms payment.
 * We verify the X-Click-Signature header (HMAC-SHA256) before trusting the payload.
 * This prevents spoofed/replayed webhooks from hostile actors.
 */
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly click: ClickPaymentProvider,
    private readonly config: AppConfig,
  ) {}

  @Public()
  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Req() req: FastifyRequest,
    @Headers('x-click-signature') clickSignature: string | undefined,
    @Body(new ZodValidationPipe(paymentWebhookSchema)) dto: ReturnType<typeof paymentWebhookSchema.parse>,
  ) {
    // If Click provider is active, verify the signature before processing.
    if (this.config.env.PAYMENT_PROVIDER === 'click') {
      // Reconstruct raw body string for signature verification.
      // Note: Express body-parser already parsed it, so we re-stringify to match Click's expectation.
      const bodyString = JSON.stringify(dto);

      if (!this.click.verifySignature(clickSignature, bodyString)) {
        throw new HttpException('Signature verification failed', HttpStatus.UNAUTHORIZED);
      }
    }

    // Process the webhook (idempotent).
    await this.payments.handleWebhook(dto.providerRef, dto.success, dto.failureReason);
    return { received: true };
  }
}
