import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { addressCreateSchema, customerProfileUpdateSchema } from '@handly/contracts';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { UsersService } from './users.service';

@Controller()
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser('id') userId: string) {
    return this.users.getMe(userId);
  }

  @Roles('CUSTOMER')
  @Patch('me/customer')
  updateCustomer(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(customerProfileUpdateSchema))
    dto: ReturnType<typeof customerProfileUpdateSchema.parse>,
  ) {
    return this.users.updateCustomerProfile(userId, dto);
  }

  @Get('me/addresses')
  addresses(@CurrentUser('id') userId: string) {
    return this.users.listAddresses(userId);
  }

  @Post('me/addresses')
  addAddress(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(addressCreateSchema))
    dto: ReturnType<typeof addressCreateSchema.parse>,
  ) {
    return this.users.createAddress(userId, dto);
  }

  @Post('me/addresses/:id/default')
  setDefault(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.setDefaultAddress(userId, id);
  }

  @Delete('me/addresses/:id')
  deleteAddress(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.deleteAddress(userId, id);
  }
}
