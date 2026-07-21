import type {
  OrderCreateInput,
  OrderDto,
  OrderListPage,
  OrderStatus,
  OrderUpdateInput,
} from '@handly/contracts';
import { api, ApiError, getAccessToken } from './api';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export const ordersApi = {
  create: (body: OrderCreateInput) => api.post<OrderDto>('/orders', body, true),
  update: (id: string, body: OrderUpdateInput) => api.patch<OrderDto>(`/orders/${id}`, body),
  get: (id: string) => api.get<OrderDto>(`/orders/${id}`),
  list: (params: { cursor?: string; status?: OrderStatus } = {}) => {
    const qs = new URLSearchParams();
    if (params.cursor) qs.set('cursor', params.cursor);
    if (params.status) qs.set('status', params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<OrderListPage>(`/orders${suffix}`);
  },
  diagnose: (id: string) => api.post<OrderDto>(`/orders/${id}/diagnose`, undefined, true),
  submit: (id: string) => api.post<OrderDto>(`/orders/${id}/submit`, { consent: true }, true),
  cancel: (id: string) => api.post<OrderDto>(`/orders/${id}/cancel`, undefined, true),
  /** Customer confirms a COMPLETED job, closing it (M4). */
  confirm: (id: string) => api.post<OrderDto>(`/orders/${id}/confirm`, undefined, true),
  deleteMedia: (orderId: string, mediaId: string) =>
    api.del<OrderDto>(`/orders/${orderId}/media/${mediaId}`),

  /** Multipart upload — bypasses the JSON-only `api` client. */
  async uploadMedia(orderId: string, file: File): Promise<OrderDto> {
    const form = new FormData();
    form.append('file', file);
    const token = getAccessToken();
    const res = await fetch(`${BASE_URL}/orders/${orderId}/media`, {
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
