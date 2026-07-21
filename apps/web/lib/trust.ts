import type { TrustScoreDto } from '@handly/contracts';
import { api } from './api';

export const trustApi = {
  getMine: () => api.get<TrustScoreDto>('/me/master/trust'),
};
