import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/auth/decorators';
import { CatalogService } from './catalog.service';

@Public()
@Controller('categories')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list() {
    return this.catalog.listCategories();
  }
}
