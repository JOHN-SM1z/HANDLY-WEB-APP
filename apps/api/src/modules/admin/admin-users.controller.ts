import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { adminUserListQuerySchema, adminUserSuspendSchema } from '@handly/contracts';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { AdminUsersService } from './admin-users.service';

@Roles('ADMIN')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  list(@Query(new ZodValidationPipe(adminUserListQuerySchema)) query: ReturnType<typeof adminUserListQuerySchema.parse>) {
    return this.adminUsers.list(query);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminUsers.detail(id);
  }

  @Post(':id/suspend')
  suspend(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(adminUserSuspendSchema)) dto: ReturnType<typeof adminUserSuspendSchema.parse>,
  ) {
    return this.adminUsers.suspend(id, adminId, dto.reason);
  }

  @Post(':id/restore')
  restore(@CurrentUser('id') adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.adminUsers.restore(id, adminId);
  }
}
