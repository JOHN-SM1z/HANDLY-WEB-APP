import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

/**
 * Global so any service (Prisma middleware, RealtimeGateway, BullMQ workers)
 * can inject MetricsService without importing this module explicitly —
 * same pattern as AuditModule/PrismaModule.
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor }],
  exports: [MetricsService],
})
export class MetricsModule {}
