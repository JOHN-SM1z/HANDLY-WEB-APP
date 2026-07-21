import { Injectable, Logger } from '@nestjs/common';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { AppConfig } from '../config/app-config';
import type { PushPayload, PushProvider } from './push-provider';

/** Real FCM provider. Only constructed/used when PUSH_PROVIDER=fcm and creds are set. */
@Injectable()
export class FcmPushProvider implements PushProvider {
  private readonly logger = new Logger('FcmPush');

  constructor(private readonly config: AppConfig) {
    if (getApps().length === 0 && this.isConfigured()) {
      initializeApp({
        credential: cert({
          projectId: this.config.env.FCM_PROJECT_ID,
          clientEmail: this.config.env.FCM_CLIENT_EMAIL,
          // .env stores the key with literal "\n" — Firebase needs real newlines.
          privateKey: this.config.env.FCM_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    }
  }

  isConfigured(): boolean {
    const { FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY } = this.config.env;
    return FCM_PROJECT_ID.length > 0 && FCM_CLIENT_EMAIL.length > 0 && FCM_PRIVATE_KEY.length > 0;
  }

  async send(deviceTokens: string[], payload: PushPayload): Promise<void> {
    if (deviceTokens.length === 0) return;
    const res = await getMessaging().sendEachForMulticast({
      tokens: deviceTokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
    });
    if (res.failureCount > 0) {
      this.logger.warn(`${res.failureCount}/${deviceTokens.length} FCM sends failed`);
    }
  }
}
