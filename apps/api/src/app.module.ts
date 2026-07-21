import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { AppConfigModule } from './infra/config/app-config';
import { CryptoModule } from './infra/crypto/crypto.module';
import { PaymentModule } from './infra/payment/payment.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';
import { StorageModule } from './infra/storage/storage.module';
import { QueueModule } from './infra/queue/queue.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { DispatchModule } from './modules/dispatch/dispatch.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { TaxModule } from './modules/tax/tax.module';
import { UsersModule } from './modules/users/users.module';

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
  ],
  controllers: [HealthController],
})
export class AppModule {}
