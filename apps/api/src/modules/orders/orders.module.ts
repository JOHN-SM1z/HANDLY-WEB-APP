import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { DispatchModule } from '../dispatch/dispatch.module';
import { GuaranteeModule } from '../guarantee/guarantee.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { PenaltiesModule } from '../penalties/penalties.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { TrustModule } from '../trust/trust.module';
import { MediaController } from './media.controller';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    AiModule,
    DispatchModule,
    RealtimeModule,
    NotificationsModule,
    PaymentsModule,
    TrustModule,
    PenaltiesModule,
    ReviewsModule,
    GuaranteeModule,
  ],
  controllers: [OrdersController, MediaController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
