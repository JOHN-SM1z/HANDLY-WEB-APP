import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories() {
    const categories = await this.prisma.serviceCategory.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });
    return categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      nameUz: c.nameUz,
      nameRu: c.nameRu,
      basePriceMin: c.basePriceMin,
      basePriceMax: c.basePriceMax,
      warrantyEligible: c.warrantyEligible,
      iconKey: c.iconKey,
    }));
  }
}
