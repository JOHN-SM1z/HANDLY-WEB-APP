import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../../common/auth/decorators';
import { MetricsService } from './metrics.service';

@Public()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Header('content-type', 'text/plain; version=0.0.4; charset=utf-8')
  async get(): Promise<string> {
    return this.metrics.getMetrics();
  }
}
