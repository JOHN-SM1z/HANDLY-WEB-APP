import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { AppConfigModule } from './infra/config/app-config';
import { CryptoModule } from './infra/crypto/crypto.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';
import { StorageModule } from './infra/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { OrdersModule } from './modules/orders/orders.module';
import { TaxModule } from './modules/tax/tax.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    RedisModule,
    CryptoModule,
    StorageModule,
    TaxModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    OrdersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
