/**
 * Tax abstraction for the 1% withholding on in-app payments to self-employed
 * masters ("o'zini o'zi band qilgan"). MVP uses MockTaxProvider; a SoliqProvider
 * (Soliq.uz API) drops in later without touching callers.
 *
 * NOTE: the exact legal obligation (whether Handly must act as withholding agent,
 * and the remittance cadence) must be confirmed with a local tax adviser before
 * this is wired into settlement in Milestone 4.
 */
export interface TaxWithholding {
  /** Fraction withheld, e.g. 0.01 for 1%. */
  rate: number;
  /** Withheld amount in integer so'm. */
  taxAmount: number;
  /** Amount paid to the master after withholding. */
  netAmount: number;
  /** Original gross payment. */
  grossAmount: number;
}

export interface RecordWithholdingInput {
  userId: string;
  paymentId: string;
  withholding: TaxWithholding;
}

export interface TaxProvider {
  /** Pure calculation — safe to call at quote time. */
  computeWithholding(grossAmount: number): TaxWithholding;
  /** Persist a withholding for later remittance. Returns a provider reference. */
  recordWithholding(input: RecordWithholdingInput): Promise<{ reference: string }>;
}

export const TAX_PROVIDER = Symbol('TAX_PROVIDER');
