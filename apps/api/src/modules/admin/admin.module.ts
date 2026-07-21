import { Module } from '@nestjs/common';
import { GuaranteeModule } from '../guarantee/guarantee.module';
import { VerificationModule } from '../verification/verification.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [VerificationModule, GuaranteeModule],
  controllers: [AdminController],
})
export class AdminModule {}
