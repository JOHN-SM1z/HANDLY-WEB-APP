import { Injectable, Logger } from '@nestjs/common';
import type { PushPayload, PushProvider } from './push-provider';

/** Dev push provider: logs to console, same spirit as SMS_PROVIDER=mock. */
@Injectable()
export class MockPushProvider implements PushProvider {
  private readonly logger = new Logger('MockPush');

  async send(deviceTokens: string[], payload: PushPayload): Promise<void> {
    if (deviceTokens.length === 0) return;
    this.logger.log(
      `📱 PUSH to [${deviceTokens.join(', ')}]: "${payload.title}" — ${payload.body}` +
        (payload.data ? ` ${JSON.stringify(payload.data)}` : ''),
    );
  }
}
