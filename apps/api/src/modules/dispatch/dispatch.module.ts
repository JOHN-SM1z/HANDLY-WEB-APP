import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { DispatchService } from './dispatch.service';
import { DispatchWorker } from './dispatch.worker';

@Module({
  imports: [NotificationsModule, RealtimeModule],
  providers: [DispatchService, DispatchWorker],
  exports: [DispatchService],
})
export class DispatchModule {}
