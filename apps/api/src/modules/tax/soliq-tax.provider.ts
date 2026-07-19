import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../infra/config/app-config';
import type { RecordWithholdingInput, TaxProvider, TaxWithholding } from './tax-provider';

/**
 * Placeholder for the real Soliq.uz integration (post-launch): remit accumulated
 * withholding to the State Tax Committee and generate receipts. Selected by
 * TAX_PROVIDER=soliq. Intentionally unimplemented so the seam is explicit.
 */
@Injectable()
export class SoliqTaxProvider implements TaxProvider {
  constructor(private readonly config: AppConfig) {}

  computeWithholding(grossAmount: number): TaxWithholding {
    const rate = this.config.env.TAX_WITHHOLDING_RATE;
    const taxAmount = Math.round(grossAmount * rate);
    return { rate, taxAmount, netAmount: grossAmount - taxAmount, grossAmount };
  }

  async recordWithholding(_input: RecordWithholdingInput): Promise<{ reference: string }> {
    throw new Error('SoliqTaxProvider.recordWithholding is not implemented yet');
  }
}
