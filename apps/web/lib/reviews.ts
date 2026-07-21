import type { ReviewCreateInput, ReviewDto } from '@handly/contracts';
import { api } from './api';

export const reviewsApi = {
  create: (orderId: string, body: ReviewCreateInput) =>
    api.post<ReviewDto>(`/orders/${orderId}/review`, body, true),
  getForOrder: (orderId: string) => api.get<ReviewDto | null>(`/orders/${orderId}/review`),
};
