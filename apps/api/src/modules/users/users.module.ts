import { Module } from '@nestjs/common';
import { DispatchModule } from '../dispatch/dispatch.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { MasterController } from './master.controller';
import { MeController } from './me.controller';
import { UsersService } from './users.service';

@Module({
  imports: [DispatchModule, OrdersModule, PaymentsModule],
  controllers: [MeController, MasterController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
