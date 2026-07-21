import type {
  MasterAvailabilityDto,
  MasterAvailabilityUpdate,
  MasterProfileDto,
  OfferDto,
  OrderDto,
  OrderListPage,
} from '@handly/contracts';
import { api, ApiError, getAccessToken } from './api';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

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

  // ─────────────── Job execution (M4) ───────────────
  startEnRoute: (orderId: string) =>
    api.post<OrderDto>(`/me/master/current-job/${orderId}/en-route`, undefined, true),
  startService: (orderId: string) =>
    api.post<OrderDto>(`/me/master/current-job/${orderId}/start`, undefined, true),
  completeService: (orderId: string, finalAmount: number) =>
    api.post<OrderDto>(`/me/master/current-job/${orderId}/complete`, { finalAmount }, true),
  /** Master backs out of an ASSIGNED/EN_ROUTE job (Batch 2) — always penalized. */
  cancelJob: (orderId: string, reason?: string) =>
    api.post<OrderDto>(`/me/master/current-job/${orderId}/cancel`, { reason }, true),
  getJobHistory: (cursor?: string) => {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return api.get<OrderListPage>(`/me/master/jobs${qs}`);
  },

  /** Multipart upload of completion evidence — bypasses the JSON-only `api` client. */
  async uploadJobMedia(orderId: string, file: File): Promise<OrderDto> {
    const form = new FormData();
    form.append('file', file);
    const token = getAccessToken();
    const res = await fetch(`${BASE_URL}/me/master/current-job/${orderId}/media`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: 'include',
      body: form,
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const message = (data.detail as string) || (data.title as string) || 'Yuklashda xatolik';
      throw new ApiError(res.status, message, data.errors as never);
    }
    return data as unknown as OrderDto;
  },
};
