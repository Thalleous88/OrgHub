import { request } from '../lib/fetcher';
import type { Notification } from '../types/api';

export async function listNotifications(filter?: 'all' | 'unread' | 'read'): Promise<Notification[]> {
  const query =
    filter === 'unread'
      ? { is_read: 'false' }
      : filter === 'read'
      ? { is_read: 'true' }
      : undefined;
  return request<Notification[]>('/notifications/', { query });
}

export async function markNotificationRead(id: number): Promise<Notification> {
  return request<Notification>(`/notifications/${id}/`, {
    method: 'PATCH',
    body: { is_read: true },
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  await request<{ detail: string }>('/notifications/mark-all-read/', {
    method: 'POST',
    body: {},
  });
}
