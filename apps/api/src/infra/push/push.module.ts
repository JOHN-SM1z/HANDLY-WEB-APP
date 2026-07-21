import { Module } from '@nestjs/common';
import { FcmPushProvider } from './fcm-push.provider';
import { MockPushProvider } from './mock-push.provider';
import { PushService } from './push.service';

@Module({
  providers: [PushService, FcmPushProvider, MockPushProvider],
  exports: [PushService],
})
export class PushModule {}
