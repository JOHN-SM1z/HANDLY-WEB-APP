import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { MediaController } from './media.controller';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [AiModule],
  controllers: [OrdersController, MediaController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
