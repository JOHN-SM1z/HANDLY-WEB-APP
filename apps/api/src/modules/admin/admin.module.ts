import { Module } from '@nestjs/common';
import { GuaranteeModule } from '../guarantee/guarantee.module';
import { PaymentsModule } from '../payments/payments.module';
import { PenaltiesModule } from '../penalties/penalties.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { TrustModule } from '../trust/trust.module';
import { VerificationModule } from '../verification/verification.module';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminAuditController } from './admin-audit.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { AdminPaymentsController } from './admin-payments.controller';
import { AdminSupportController } from './admin-support.controller';
import { AdminSupportService } from './admin-support.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [VerificationModule, GuaranteeModule, PenaltiesModule, ReferralsModule, TrustModule, PaymentsModule],
  controllers: [
    AdminController,
    AdminUsersController,
    AdminOrdersController,
    AdminAnalyticsController,
    AdminAuditController,
    AdminSupportController,
    AdminPaymentsController,
  ],
  providers: [AdminUsersService, AdminOrdersService, AdminAnalyticsService, AdminSupportService],
})
export class AdminModule {}
