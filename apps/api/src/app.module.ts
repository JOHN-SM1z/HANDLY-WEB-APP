import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { AppConfigModule } from './infra/config/app-config';
import { CryptoModule } from './infra/crypto/crypto.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { TaxModule } from './modules/tax/tax.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    RedisModule,
    CryptoModule,
    TaxModule,
    AuthModule,
    UsersModule,
    CatalogModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
