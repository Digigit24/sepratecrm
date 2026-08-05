import { useEffect, useRef } from 'react';
import useSWR from 'swr';
import Pusher from 'pusher-js';
import { toast } from 'sonner';

import { API_CONFIG } from '@/lib/apiConfig';
import { tokenManager } from '@/lib/client';
import { authService } from '@/services/authService';
import { notificationService } from '@/services/notificationService';
import type { CRMNotification, NotificationListResponse } from '@/types/notificationTypes';

interface UseNotificationsOptions {
  unreadOnly?: boolean;
  onNotification?: (notification: CRMNotification) => void;
}

export const useNotifications = ({ unreadOnly = false, onNotification }: UseNotificationsOptions = {}) => {
  const onNotificationRef = useRef(onNotification);
  useEffect(() => { onNotificationRef.current = onNotification; }, [onNotification]);

  const list = useSWR<NotificationListResponse>(
    ['crm-notifications', unreadOnly],
    () => notificationService.list(unreadOnly),
    {
      refreshInterval: 30_000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      keepPreviousData: true,
      shouldRetryOnError: false,
    },
  );
  const count = useSWR<number>(
    'crm-notifications-unread-count',
    () => notificationService.unreadCount(),
    {
      refreshInterval: 30_000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      shouldRetryOnError: false,
    },
  );
  const mutateList = list.mutate;
  const mutateCount = count.mutate;

  useEffect(() => {
    if (import.meta.env.VITE_CRM_NOTIFICATIONS_REALTIME === 'false') return;
    const user = authService.getCurrentUser();
    const tenant = authService.getTenant();
    const tenantId = tenant?.id || (tenant as { tenant_id?: string } | null)?.tenant_id;
    const token = tokenManager.getAccessToken();
    if (!user?.id || !tenantId || !token) return;

    const key = import.meta.env.VITE_PUSHER_KEY || '649db422ae8f2e9c7a9d';
    const cluster = import.meta.env.VITE_PUSHER_CLUSTER || 'ap2';
    const pusher = new Pusher(key, {
      cluster,
      forceTLS: true,
      channelAuthorization: {
        endpoint: `${API_CONFIG.CRM_BASE_URL}${API_CONFIG.CRM.NOTIFICATION_REALTIME_AUTH}`,
        transport: 'ajax',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': String(tenantId),
        },
      },
    });
    const channel = pusher.subscribe(`private-crm-notifications.${tenantId}.${user.id}`);
    const handleCreated = (notification: CRMNotification) => {
      void mutateList();
      void mutateCount();
      toast(notification.title, {
        description: notification.body,
        action: notification.action_url
          ? { label: 'Open lead', onClick: () => onNotificationRef.current?.(notification) }
          : undefined,
      });
    };
    channel.bind('notification.created', handleCreated);

    return () => {
      channel.unbind('notification.created', handleCreated);
      pusher.unsubscribe(channel.name);
      pusher.disconnect();
    };
  }, [mutateCount, mutateList]);

  const markRead = async (notification: CRMNotification) => {
    if (!notification.is_read) await notificationService.markRead(notification.id);
    await Promise.all([list.mutate(), count.mutate()]);
  };

  const markAllRead = async () => {
    await notificationService.markAllRead();
    await Promise.all([list.mutate(), count.mutate(0, { revalidate: false })]);
  };

  const markSeen = () => notificationService.markSeen();

  return {
    notifications: list.data,
    unreadCount: count.data ?? 0,
    isLoading: list.isLoading,
    error: list.error,
    markRead,
    markAllRead,
    markSeen,
    refresh: () => Promise.all([list.mutate(), count.mutate()]),
  };
};
