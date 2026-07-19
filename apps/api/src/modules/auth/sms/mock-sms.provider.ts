import { Injectable, Logger } from '@nestjs/common';
import type { SmsProvider } from './sms-provider';

/** Dev/test provider — prints the OTP to the API log instead of sending an SMS. */
@Injectable()
export class MockSmsProvider implements SmsProvider {
  private readonly logger = new Logger('MockSms');

  async sendOtp(phone: string, code: string): Promise<void> {
    this.logger.log(`📱 OTP for ${phone}: ${code}`);
  }

  async sendSms(phone: string, message: string): Promise<void> {
    this.logger.log(`📱 SMS to ${phone}: ${message}`);
  }
}
