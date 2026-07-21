import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { TrustModule } from '../trust/trust.module';
import { PenaltiesService } from './penalties.service';

@Module({
  imports: [TrustModule, NotificationsModule],
  providers: [PenaltiesService],
  exports: [PenaltiesService],
})
export class PenaltiesModule {}
