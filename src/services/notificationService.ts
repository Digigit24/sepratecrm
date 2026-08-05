import { crmClient } from '@/lib/client';
import { API_CONFIG, buildQueryString } from '@/lib/apiConfig';
import type { CRMNotification, NotificationListResponse } from '@/types/notificationTypes';

class NotificationService {
  async list(unreadOnly = false): Promise<NotificationListResponse> {
    const query = buildQueryString({ unread: unreadOnly || undefined, page_size: 30 });
    const response = await crmClient.get<NotificationListResponse>(
      `${API_CONFIG.CRM.NOTIFICATIONS}${query}`,
    );
    return response.data;
  }

  async unreadCount(): Promise<number> {
    const response = await crmClient.get<{ count: number }>(
      API_CONFIG.CRM.NOTIFICATION_UNREAD_COUNT,
    );
    return response.data.count;
  }

  async markRead(id: number): Promise<CRMNotification> {
    const response = await crmClient.post<CRMNotification>(
      API_CONFIG.CRM.NOTIFICATION_MARK_READ.replace(':id', String(id)),
    );
    return response.data;
  }

  async markAllRead(): Promise<number> {
    const response = await crmClient.post<{ updated: number }>(
      API_CONFIG.CRM.NOTIFICATION_MARK_ALL_READ,
    );
    return response.data.updated;
  }

  async markSeen(): Promise<void> {
    await crmClient.post(API_CONFIG.CRM.NOTIFICATION_MARK_SEEN);
  }
}

export const notificationService = new NotificationService();

