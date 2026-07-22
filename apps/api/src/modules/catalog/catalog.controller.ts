import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../../common/auth/decorators';
import { CatalogService } from './catalog.service';

@Public()
@Controller('categories')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  // Batch 3 perf: categories change rarely (admin-seeded, not user-authored) —
  // a short public cache cuts a hot, unauthenticated, identical-for-everyone
  // request from every /home and /orders/new load. Same header-setting
  // precedent as media.controller.ts, no new caching infra.
  @Header('cache-control', 'public, max-age=60')
  @Get()
  list() {
    return this.catalog.listCategories();
  }
}
