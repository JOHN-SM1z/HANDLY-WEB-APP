import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { paymentWebhookSchema } from '@handly/contracts';
import { Public } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { PaymentsService } from './payments.service';

/**
 * Public webhook for async provider confirmation (M5). `providerRef` acts as
 * an unguessable bearer token — same trust model as `GET /media/:id` — since
 * no real Click/Payme/Uzum merchant account (and its signature scheme) exists
 * yet. MockPaymentProvider settles synchronously inside `initiate()`, so this
 * path isn't exercised in practice today; it exists as the documented
 * extension point a real async rail will call. Before enabling a real rail,
 * add that provider's signature verification here.
 */
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Public()
  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Body(new ZodValidationPipe(paymentWebhookSchema)) dto: ReturnType<typeof paymentWebhookSchema.parse>,
  ) {
    await this.payments.handleWebhook(dto.providerRef, dto.success, dto.failureReason);
    return { received: true };
  }
}
