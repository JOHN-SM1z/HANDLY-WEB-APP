import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { masterProfileUpdateSchema } from '@handly/contracts';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { UsersService } from './users.service';

const mediaSchema = z.object({
  kind: z.enum(['CERTIFICATION', 'PORTFOLIO']),
  objectKey: z.string().min(1).max(300),
  caption: z.string().max(200).optional(),
});

@Roles('MASTER')
@Controller('me/master')
export class MasterController {
  constructor(private readonly users: UsersService) {}

  @Get()
  get(@CurrentUser('id') userId: string) {
    return this.users.getMasterProfile(userId);
  }

  @Patch()
  update(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(masterProfileUpdateSchema))
    dto: ReturnType<typeof masterProfileUpdateSchema.parse>,
  ) {
    return this.users.updateMasterProfile(userId, dto);
  }

  @Post('media')
  addMedia(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(mediaSchema)) dto: z.infer<typeof mediaSchema>,
  ) {
    return this.users.addMasterMedia(userId, dto);
  }

  @Delete('media/:id')
  deleteMedia(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.deleteMasterMedia(userId, id);
  }
}
