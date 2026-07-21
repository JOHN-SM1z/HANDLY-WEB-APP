import type { GuaranteeClaimCreateInput, GuaranteeClaimDto } from '@handly/contracts';
import { api } from './api';

export const guaranteeApi = {
  fileClaim: (orderId: string, body: GuaranteeClaimCreateInput) =>
    api.post<GuaranteeClaimDto>(`/orders/${orderId}/guarantee-claim`, body, true),
  getForOrder: (orderId: string) => api.get<GuaranteeClaimDto | null>(`/orders/${orderId}/guarantee-claim`),
};
