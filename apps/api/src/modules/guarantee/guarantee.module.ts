import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { GuaranteeService } from './guarantee.service';

@Module({
  imports: [NotificationsModule],
  providers: [GuaranteeService],
  exports: [GuaranteeService],
})
export class GuaranteeModule {}
