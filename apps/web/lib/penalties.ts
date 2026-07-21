import type { PenaltyHistoryPage } from '@handly/contracts';
import { api } from './api';

export const penaltiesApi = {
  getMine: () => api.get<PenaltyHistoryPage>('/me/master/penalties'),
};
