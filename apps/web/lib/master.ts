import type {
  MasterAvailabilityDto,
  MasterAvailabilityUpdate,
  MasterProfileDto,
  OfferDto,
  OrderDto,
} from '@handly/contracts';
import { api } from './api';

export const masterApi = {
  getProfile: () => api.get<MasterProfileDto>('/me/master'),
  setAvailability: (body: MasterAvailabilityUpdate) =>
    api.patch<MasterAvailabilityDto>('/me/master/availability', body),
  getCurrentOffer: () => api.get<OfferDto | null>('/me/master/offers/current'),
  acceptOffer: (dispatchId: string) =>
    api.post<void>(`/me/master/offers/${dispatchId}/accept`, undefined, true),
  declineOffer: (dispatchId: string) =>
    api.post<void>(`/me/master/offers/${dispatchId}/decline`, undefined, true),
  getCurrentJob: () => api.get<OrderDto | null>('/me/master/current-job'),
};
