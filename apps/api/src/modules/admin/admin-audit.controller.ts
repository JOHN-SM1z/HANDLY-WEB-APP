import { Controller, Get, Query } from '@nestjs/common';
import { adminAuditLogQuerySchema } from '@handly/contracts';
import { Roles } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { AuditService } from '../audit/audit.service';

@Roles('ADMIN')
@Controller('admin/audit-log')
export class AdminAuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(adminAuditLogQuerySchema)) query: ReturnType<typeof adminAuditLogQuerySchema.parse>,
  ) {
    return this.audit.list(query.cursor, query.actorId, query.entityType);
  }
}
