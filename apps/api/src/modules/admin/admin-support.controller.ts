import { Controller, Get, Query } from '@nestjs/common';
import { adminSupportLookupQuerySchema } from '@handly/contracts';
import { Roles } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { AdminSupportService } from './admin-support.service';

@Roles('ADMIN')
@Controller('admin/support')
export class AdminSupportController {
  constructor(private readonly support: AdminSupportService) {}

  @Get('lookup')
  lookup(
    @Query(new ZodValidationPipe(adminSupportLookupQuerySchema))
    query: ReturnType<typeof adminSupportLookupQuerySchema.parse>,
  ) {
    return this.support.lookupByPhone(query.phone);
  }
}
