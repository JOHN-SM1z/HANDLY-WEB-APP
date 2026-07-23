import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../../infra/config/app-config';
import type { SmsProvider } from './sms-provider';

interface EskizAuthResponse {
  data?: { token?: string };
}

// Vercel's build environment has been observed resolving the ambient
// `Response` type from global `fetch` without ok/status/json/text
// (works locally; not reproducible outside that build). Casting through
// this explicit shape avoids depending on whichever `Response` the
// build's TypeScript/@types/node resolution happens to pick up.
interface FetchLikeResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

/**
 * Eskiz.uz SMS gateway adapter. Authenticates with email/password to obtain a
 * bearer token (cached), then posts messages. Enabled by SMS_PROVIDER=eskiz.
 */
@Injectable()
export class EskizSmsProvider implements SmsProvider {
  private readonly logger = new Logger('EskizSms');
  private token?: string;
  private tokenExpiresAt = 0;

  constructor(private readonly config: AppConfig) {}

  private async authenticate(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;

    const { ESKIZ_BASE_URL, ESKIZ_EMAIL, ESKIZ_PASSWORD } = this.config.env;
    const res = (await fetch(`${ESKIZ_BASE_URL}/auth/login`, {
      method: 'POST',
      body: new URLSearchParams({ email: ESKIZ_EMAIL, password: ESKIZ_PASSWORD }),
    })) as unknown as FetchLikeResponse;
    if (!res.ok) throw new Error(`Eskiz auth failed: ${res.status}`);

    const json = (await res.json()) as EskizAuthResponse;
    const token = json.data?.token;
    if (!token) throw new Error('Eskiz auth returned no token');

    this.token = token;
    // Eskiz tokens last ~30 days; refresh a little early.
    this.tokenExpiresAt = Date.now() + 25 * 24 * 60 * 60 * 1000;
    return token;
  }

  private async send(phone: string, message: string): Promise<void> {
    const token = await this.authenticate();
    const res = (await fetch(`${this.config.env.ESKIZ_BASE_URL}/message/sms/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: new URLSearchParams({
        mobile_phone: phone.replace('+', ''),
        message,
        from: this.config.env.ESKIZ_FROM,
      }),
    })) as unknown as FetchLikeResponse;
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.logger.error(`Eskiz send failed: ${res.status} ${detail}`);
      throw new Error(`Eskiz send failed: ${res.status}`);
    }
  }

  async sendOtp(phone: string, code: string): Promise<void> {
    await this.send(phone, `Handly tasdiqlash kodi: ${code}. Hech kimga bermang.`);
  }

  async sendSms(phone: string, message: string): Promise<void> {
    await this.send(phone, message);
  }
}
