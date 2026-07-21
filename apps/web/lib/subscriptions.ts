import type { MasterSubscriptionDto } from '@handly/contracts';
import { api } from './api';

export const subscriptionsApi = {
  getMine: () => api.get<MasterSubscriptionDto>('/me/master/subscription'),
  upgrade: () => api.post<MasterSubscriptionDto>('/me/master/subscription/upgrade', undefined, true),
};
