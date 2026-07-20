import { api } from './api';

export interface CategoryDto {
  id: string;
  slug: string;
  nameUz: string;
  nameRu: string;
  basePriceMin: number;
  basePriceMax: number;
  warrantyEligible: boolean;
  iconKey: string | null;
}

export const categoriesApi = {
  list: () => api.get<CategoryDto[]>('/categories', false),
};
