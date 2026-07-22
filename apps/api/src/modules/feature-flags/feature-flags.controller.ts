import { Body, Controller, Get, Post } from '@nestjs/common';
import { featureFlagUpsertSchema } from '@handly/contracts';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { FeatureFlagsService } from './feature-flags.service';

@Roles('ADMIN')
@Controller('admin/feature-flags')
export class FeatureFlagsController {
  constructor(private readonly flags: FeatureFlagsService) {}

  @Get()
  list() {
    return this.flags.list();
  }

  @Post()
  upsert(
    @CurrentUser('id') adminId: string,
    @Body(new ZodValidationPipe(featureFlagUpsertSchema)) dto: ReturnType<typeof featureFlagUpsertSchema.parse>,
  ) {
    return this.flags.upsert(adminId, dto.key, dto.enabled, dto.description);
  }
}
