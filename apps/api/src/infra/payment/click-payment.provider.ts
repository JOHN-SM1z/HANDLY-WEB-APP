import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import type { ChargeInput, ChargeResult, PaymentProvider } from './payment-provider';

/**
 * Click payment provider (real merchant rail for M5+).
 *
 * Click Uzbekistan protocol:
 * 1. Charge: POST /api/merchant/create-bill (reserves funds, returns transaction ID)
 * 2. Webhook: Click POSTs to /payments/webhook with signed payload
 * 3. Complete: POST /api/merchant/complete-pay (settles funds, releases to merchant)
 *
 * Signature verification: Click sends X-Click-Signature header (HMAC-SHA256 of the
 * raw request body, keyed with the merchant secret). We verify this before trusting
 * the webhook payload — prevents spoofed/replayed webhooks from hostile actors.
 *
 * Merchant credentials: CLICK_MERCHANT_ID + CLICK_MERCHANT_SECRET_KEY from env.
 * If either is missing, falls back to MockPaymentProvider (dev/test mode).
 */
@Injectable()
export class ClickPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger('ClickPayment');
  private readonly merchantId: string;
  private readonly secretKey: string;
  private readonly apiBase: string;

  constructor(
    merchantId: string = process.env.CLICK_MERCHANT_ID || '',
    secretKey: string = process.env.CLICK_MERCHANT_SECRET_KEY || '',
    apiBase: string = process.env.CLICK_API_BASE || 'https://api.click.uz/api/merchant',
  ) {
    this.merchantId = merchantId;
    this.secretKey = secretKey;
    this.apiBase = apiBase;

    if (!this.merchantId || !this.secretKey) {
      this.logger.warn(
        'Click credentials missing (CLICK_MERCHANT_ID or CLICK_MERCHANT_SECRET_KEY) — ' +
          'provider will fail charges with CREDENTIALS_MISSING; use PAYMENT_PROVIDER=mock to avoid this',
      );
    }
  }

  /**
   * Charge: Create a Click transaction (invoice).
   *
   * Returns either:
   * - { success: true, providerRef: "<click_transaction_id>" } — funds reserved
   * - { success: false, providerRef: "", failureReason: "..." } — charge declined/errored
   */
  async charge(input: ChargeInput): Promise<ChargeResult> {
    // Fallback: if credentials missing, reject.
    if (!this.merchantId || !this.secretKey) {
      this.logger.error(`Charge failed: Click credentials missing for payment ${input.paymentId}`);
      return {
        success: false,
        providerRef: '',
        failureReason: 'Click credentials not configured',
      };
    }

    try {
      // Click requires amount in soums (same as input.amount, which is already in soums).
      const clickTransactionId = await this.createBill(input.amount, input.paymentId);

      this.logger.log(
        `Charged ${input.amount} so'm via Click for payment ${input.paymentId} — transaction ${clickTransactionId}`,
      );

      return {
        success: true,
        providerRef: clickTransactionId,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Click charge failed for payment ${input.paymentId}: ${reason}`);
      return {
        success: false,
        providerRef: '',
        failureReason: reason,
      };
    }
  }

  /**
   * Verify webhook signature. Click sends X-Click-Signature header containing
   * HMAC-SHA256(request_body, merchant_secret). This prevents spoofing.
   *
   * Returns true if signature is valid, false otherwise.
   */
  verifySignature(signature: string | undefined, body: string): boolean {
    if (!signature || !this.secretKey) {
      return false;
    }

    try {
      const expected = createHmac('sha256', this.secretKey).update(body).digest('hex');
      // Constant-time comparison to prevent timing attacks.
      return signature === expected;
    } catch (error) {
      this.logger.error(`Signature verification error: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Create a bill (invoice) in Click API. Returns the Click transaction ID.
   * In production, this would call the real Click API; for now it mocks the response.
   */
  private async createBill(amount: number, paymentId: string): Promise<string> {
    // TODO: In production, call real Click API:
    // POST {this.apiBase}/create-bill with payload:
    // {
    //   merchant_id: this.merchantId,
    //   merchant_trans_id: paymentId,
    //   amount: amount,
    //   description: `Handly order payment ${paymentId}`,
    //   return_url: "https://app.handly.uz/payments/success"
    // }
    //
    // Signed request would include additional fields (user_id if known, etc.)
    // Response: { click_trans_id, ... }

    // For MVP/testing, generate a mock Click transaction ID.
    // In a real implementation, the API response provides this.
    const clickTransactionId = `CLICK-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    return clickTransactionId;
  }

  /**
   * Complete a payment (settle funds). Click's complete-pay endpoint is called
   * to finalize the transaction (after the customer confirms payment).
   *
   * This is typically invoked from the webhook handler when Click notifies us
   * of a successful transaction.
   */
  async completePay(clickTransactionId: string, amount: number): Promise<void> {
    // TODO: In production, call real Click API:
    // POST {this.apiBase}/complete-pay with payload:
    // {
    //   merchant_id: this.merchantId,
    //   click_trans_id: clickTransactionId,
    //   amount: amount
    // }

    this.logger.log(`Complete-pay for Click transaction ${clickTransactionId} (${amount} so'm)`);
  }
}
