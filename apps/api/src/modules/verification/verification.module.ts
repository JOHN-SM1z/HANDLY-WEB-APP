import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { VerificationService } from './verification.service';

@Module({
  imports: [NotificationsModule],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
