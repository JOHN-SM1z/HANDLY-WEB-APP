import type { NotificationDto, NotificationListPage } from '@handly/contracts';
import { api } from './api';

export const notificationsApi = {
  list: (cursor?: string) => {
    const suffix = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return api.get<NotificationListPage>(`/notifications${suffix}`);
  },
  unreadCount: () => api.get<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) => api.patch<NotificationDto>(`/notifications/${id}/read`),
};
