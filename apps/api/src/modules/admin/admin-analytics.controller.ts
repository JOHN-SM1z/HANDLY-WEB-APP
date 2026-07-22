import { Controller, Get, Query } from '@nestjs/common';
import { adminAnalyticsQuerySchema } from '@handly/contracts';
import { Roles } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { AdminAnalyticsService } from './admin-analytics.service';

@Roles('ADMIN')
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly analytics: AdminAnalyticsService) {}

  @Get('overview')
  overview(
    @Query(new ZodValidationPipe(adminAnalyticsQuerySchema)) query: ReturnType<typeof adminAnalyticsQuerySchema.parse>,
  ) {
    return this.analytics.overview(query);
  }
}
