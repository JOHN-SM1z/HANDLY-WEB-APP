import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TrustModule } from '../trust/trust.module';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [TrustModule, ReviewsModule, SubscriptionsModule, PaymentsModule],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
