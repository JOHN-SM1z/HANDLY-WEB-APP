import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { AppConfigModule } from './infra/config/app-config';
import { CryptoModule } from './infra/crypto/crypto.module';
import { PaymentModule } from './infra/payment/payment.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';
import { StorageModule } from './infra/storage/storage.module';
import { QueueModule } from './infra/queue/queue.module';
import { AdminModule } from './modules/admin/admin.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { DispatchModule } from './modules/dispatch/dispatch.module';
import { GuaranteeModule } from './modules/guarantee/guarantee.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PenaltiesModule } from './modules/penalties/penalties.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { TaxModule } from './modules/tax/tax.module';
import { TrustModule } from './modules/trust/trust.module';
import { UsersModule } from './modules/users/users.module';
import { VerificationModule } from './modules/verification/verification.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    RedisModule,
    QueueModule,
    CryptoModule,
    StorageModule,
    TaxModule,
    PaymentModule,
    AuthModule,
    RealtimeModule,
    NotificationsModule,
    UsersModule,
    CatalogModule,
    OrdersModule,
    DispatchModule,
    PaymentsModule,
    TrustModule,
    VerificationModule,
    ReviewsModule,
    GuaranteeModule,
    PenaltiesModule,
    ReferralsModule,
    SubscriptionsModule,
    AnalyticsModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
