import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { FcmPushProvider } from './fcm-push.provider';
import { MockPushProvider } from './mock-push.provider';
import type { PushPayload } from './push-provider';

/**
 * Facade the rest of the app talks to. Picks FCM when configured, and ALWAYS
 * falls back to the mock (console log) on any failure or when unconfigured —
 * a failed push must never block a dispatch/order flow. Mirrors AiService.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly config: AppConfig,
    private readonly fcm: FcmPushProvider,
    private readonly mock: MockPushProvider,
  ) {}

  private fcmEnabled(): boolean {
    return this.config.env.PUSH_PROVIDER === 'fcm' && this.fcm.isConfigured();
  }

  async send(deviceTokens: string[], payload: PushPayload): Promise<void> {
    if (this.fcmEnabled()) {
      try {
        await this.fcm.send(deviceTokens, payload);
        return;
      } catch (err) {
        this.logger.warn(`FCM push failed, falling back to mock: ${(err as Error).message}`);
      }
    }
    await this.mock.send(deviceTokens, payload);
  }
}
