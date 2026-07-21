import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { ChargeInput, ChargeResult, PaymentProvider } from './payment-provider';

/** Dev/test rail: always succeeds instantly (no real merchant account exists). */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger('MockPayment');

  async charge(input: ChargeInput): Promise<ChargeResult> {
    const providerRef = `MOCK-PAY-${randomUUID()}`;
    this.logger.log(`Charged ${input.amount} so'm via ${input.method} for payment ${input.paymentId} — ref ${providerRef}`);
    return { success: true, providerRef };
  }
}
