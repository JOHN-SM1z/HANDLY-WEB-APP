import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { DispatchModule } from '../dispatch/dispatch.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { PenaltiesModule } from '../penalties/penalties.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TrustModule } from '../trust/trust.module';
import { VerificationModule } from '../verification/verification.module';
import { MasterController } from './master.controller';
import { MeController } from './me.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    DispatchModule,
    OrdersModule,
    PaymentsModule,
    TrustModule,
    VerificationModule,
    PenaltiesModule,
    SubscriptionsModule,
    ReferralsModule,
    AnalyticsModule,
  ],
  controllers: [MeController, MasterController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
