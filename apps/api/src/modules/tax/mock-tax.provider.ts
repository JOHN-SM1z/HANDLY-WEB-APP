import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../infra/config/app-config';
import type { RecordWithholdingInput, TaxProvider, TaxWithholding } from './tax-provider';

/** MVP tax provider: computes the configured rate and records to the log. */
@Injectable()
export class MockTaxProvider implements TaxProvider {
  private readonly logger = new Logger('MockTax');

  constructor(private readonly config: AppConfig) {}

  computeWithholding(grossAmount: number): TaxWithholding {
    const rate = this.config.env.TAX_WITHHOLDING_RATE;
    const taxAmount = Math.round(grossAmount * rate);
    return { rate, taxAmount, netAmount: grossAmount - taxAmount, grossAmount };
  }

  async recordWithholding(input: RecordWithholdingInput): Promise<{ reference: string }> {
    const reference = `MOCK-TAX-${Date.now()}`;
    this.logger.log(
      `Withheld ${input.withholding.taxAmount} so'm (${input.withholding.rate * 100}%) ` +
        `for payment ${input.paymentId} / user ${input.userId} — ref ${reference}`,
    );
    return { reference };
  }
}
