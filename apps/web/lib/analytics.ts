import type { MasterAnalyticsDto } from '@handly/contracts';
import { api } from './api';

export const analyticsApi = {
  getMine: () => api.get<MasterAnalyticsDto>('/me/master/analytics'),
};
