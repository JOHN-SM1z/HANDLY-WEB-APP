import type { MasterEarningsPage, PaymentDto, PaymentListPage, PaymentMethod } from '@handly/contracts';
import { api } from './api';

export const paymentsApi = {
  initiate: (orderId: string, method: PaymentMethod) =>
    api.post<PaymentDto>(`/orders/${orderId}/payments`, { method }, true),
  list: (orderId: string) => api.get<PaymentListPage>(`/orders/${orderId}/payments`),
  getMasterEarnings: (cursor?: string) => {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return api.get<MasterEarningsPage>(`/me/master/earnings${qs}`);
  },
};
