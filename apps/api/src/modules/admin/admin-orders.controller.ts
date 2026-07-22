import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { adminOrderListQuerySchema } from '@handly/contracts';
import { Roles } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { AdminOrdersService } from './admin-orders.service';

@Roles('ADMIN')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly adminOrders: AdminOrdersService) {}

  @Get()
  list(@Query(new ZodValidationPipe(adminOrderListQuerySchema)) query: ReturnType<typeof adminOrderListQuerySchema.parse>) {
    return this.adminOrders.list(query);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminOrders.detail(id);
  }
}
