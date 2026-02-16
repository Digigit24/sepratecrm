// ==================== USE SCHEDULING HOOK ====================
// Custom hook for WhatsApp message scheduling

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { schedulingService } from '@/services/schedulingService';
import { DEFAULT_TIMEZONE, DEFAULT_TEMPLATE_LANGUAGE } from '@/constants/scheduling';
import type {
  ScheduledMessage,
  ScheduledEvent,
  ReminderConfig,
  QueueStats,
  HealthStatus,
  ScheduleEventRequest,
  ScheduleEventResponse,
  ScheduleMessageRequest,
  ScheduleBulkMessagesRequest,
  ScheduleBulkMessagesResponse,
  SaveReminderConfigRequest,
  MessageStatusFilter,
  EventStatusFilter,
  MessageType,
  MediaData,
  SchedulingContact,
} from '@/types/scheduling.types';

export interface UseSchedulingReturn {
  // Event scheduling
  scheduleEvent: (
    eventType: string,
    contactPhone: string,
    eventAt: string,
    metadata?: Record<string, unknown>,
    options?: { timezone?: string; contactName?: string }
  ) => Promise<{ success: boolean; data?: ScheduleEventResponse; error?: string }>;
  cancelEvent: (eventUid: string) => Promise<{ success: boolean; error?: string }>;
  getScheduledEvents: (status?: EventStatusFilter) => Promise<{ success: boolean; data?: ScheduledEvent[]; error?: string }>;

  // Message scheduling
  scheduleMessage: (data: ScheduleMessageRequest) => Promise<{ success: boolean; data?: ScheduledMessage; error?: string }>;
  scheduleTemplateMessage: (
    contactPhone: string,
    sendAt: string,
    templateName: string,
    templateParams?: Record<string, string>,
    options?: { contactName?: string; timezone?: string; templateLanguage?: string }
  ) => Promise<{ success: boolean; data?: ScheduledMessage; error?: string }>;
  scheduleTextMessage: (
    contactPhone: string,
    sendAt: string,
    messageContent: string,
    options?: { contactName?: string; timezone?: string }
  ) => Promise<{ success: boolean; data?: ScheduledMessage; error?: string }>;
  scheduleMediaMessage: (
    contactPhone: string,
    sendAt: string,
    mediaData: MediaData,
    options?: { contactName?: string; timezone?: string }
  ) => Promise<{ success: boolean; data?: ScheduledMessage; error?: string }>;
  scheduleBulkMessages: (
    contacts: SchedulingContact[],
    messageData: Omit<ScheduleBulkMessagesRequest, 'contacts'>,
  ) => Promise<{ success: boolean; data?: ScheduleBulkMessagesResponse; error?: string }>;
  cancelMessage: (messageUid: string) => Promise<{ success: boolean; error?: string }>;
  getScheduledMessages: (status?: MessageStatusFilter) => Promise<{ success: boolean; data?: ScheduledMessage[]; error?: string }>;
  getScheduledMessage: (messageUid: string) => Promise<{ success: boolean; data?: ScheduledMessage; error?: string }>;

  // Stats & Health
  getQueueStats: () => Promise<{ success: boolean; data?: QueueStats; error?: string }>;
  getHealth: () => Promise<{ success: boolean; data?: HealthStatus; error?: string }>;

  // Reminder configs (admin)
  saveReminderConfig: (config: SaveReminderConfigRequest) => Promise<{ success: boolean; data?: ReminderConfig; error?: string }>;
  getReminderConfigs: (eventType?: string) => Promise<{ success: boolean; data?: ReminderConfig[]; error?: string }>;
  deleteReminderConfig: (configUid: string) => Promise<{ success: boolean; error?: string }>;

  // State
  loading: boolean;
  error: string | null;
  scheduledMessages: ScheduledMessage[];
  scheduledEvents: ScheduledEvent[];
  reminderConfigs: ReminderConfig[];
  queueStats: QueueStats | null;
  healthStatus: HealthStatus | null;

  // Utilities
  isVendorConfigured: boolean;
  clearError: () => void;
  refreshAll: () => Promise<void>;
}

export function useScheduling(): UseSchedulingReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [scheduledEvents, setScheduledEvents] = useState<ScheduledEvent[]>([]);
  const [reminderConfigs, setReminderConfigs] = useState<ReminderConfig[]>([]);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);

  const isVendorConfigured = schedulingService.isVendorConfigured();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ==================== ERROR HANDLING ====================

  const handleError = useCallback((err: unknown, showToast = true): string => {
    let errorMessage = 'An unexpected error occurred';

    if (err instanceof Error) {
      errorMessage = err.message;
    } else if (typeof err === 'object' && err !== null) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      errorMessage = errorObj.response?.data?.message || errorObj.message || errorMessage;
    }

    setError(errorMessage);
    if (showToast) {
      toast.error(errorMessage);
    }

    return errorMessage;
  }, []);

  // ==================== EVENT SCHEDULING ====================

  const scheduleEvent = useCallback(async (
    eventType: string,
    contactPhone: string,
    eventAt: string,
    metadata?: Record<string, unknown>,
    options?: { timezone?: string; contactName?: string }
  ) => {
    setLoading(true);
    setError(null);

    try {
      const request: ScheduleEventRequest = {
        event_type: eventType,
        contact_phone: contactPhone,
        event_at: eventAt,
        timezone: options?.timezone || DEFAULT_TIMEZONE,
        contact_name: options?.contactName,
        metadata,
      };

      const response = await schedulingService.scheduleEvent(request);

      if (response.reaction === 1) {
        toast.success(response.message || 'Event scheduled successfully');
        return { success: true, data: response.data };
      } else {
        const errorMsg = response.message || 'Failed to schedule event';
        setError(errorMsg);
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (err) {
      const errorMsg = handleError(err);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const cancelEvent = useCallback(async (eventUid: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await schedulingService.cancelEvent(eventUid);

      if (response.reaction === 1) {
        toast.success(response.message || 'Event cancelled successfully');
        // Remove from local state
        setScheduledEvents(prev => prev.filter(e => e._uid !== eventUid));
        return { success: true };
      } else {
        const errorMsg = response.message || 'Failed to cancel event';
        setError(errorMsg);
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (err) {
      const errorMsg = handleError(err);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const getScheduledEvents = useCallback(async (status?: EventStatusFilter) => {
    setLoading(true);
    setError(null);

    try {
      const response = await schedulingService.getScheduledEvents({
        status: schedulingService.getEventStatusParam(status) as EventStatusFilter,
      });

      if (response.reaction === 1) {
        // Ensure data is always an array
        const events = Array.isArray(response.data) ? response.data : [];
        setScheduledEvents(events);
        return { success: true, data: events };
      } else {
        const errorMsg = response.message || 'Failed to fetch scheduled events';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (err) {
      const errorMsg = handleError(err, false);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  // ==================== MESSAGE SCHEDULING ====================

  const scheduleMessage = useCallback(async (data: ScheduleMessageRequest) => {
    setLoading(true);
    setError(null);

    try {
      const response = await schedulingService.scheduleMessage(data);

      if (response.reaction === 1) {
        toast.success(response.message || 'Message scheduled successfully');
        return { success: true, data: response.data };
      } else {
        const errorMsg = response.message || 'Failed to schedule message';
        setError(errorMsg);
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (err) {
      const errorMsg = handleError(err);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const scheduleTemplateMessage = useCallback(async (
    contactPhone: string,
    sendAt: string,
    templateName: string,
    templateParams?: Record<string, string>,
    options?: { contactName?: string; timezone?: string; templateLanguage?: string }
  ) => {
    const data: ScheduleMessageRequest = {
      contact_phone: contactPhone,
      send_at: sendAt,
      timezone: options?.timezone || DEFAULT_TIMEZONE,
      message_type: 'template' as MessageType,
      template_name: templateName,
      template_language: options?.templateLanguage || DEFAULT_TEMPLATE_LANGUAGE,
      template_params: templateParams,
      contact_name: options?.contactName,
    };

    return scheduleMessage(data);
  }, [scheduleMessage]);

  const scheduleTextMessage = useCallback(async (
    contactPhone: string,
    sendAt: string,
    messageContent: string,
    options?: { contactName?: string; timezone?: string }
  ) => {
    const data: ScheduleMessageRequest = {
      contact_phone: contactPhone,
      send_at: sendAt,
      timezone: options?.timezone || DEFAULT_TIMEZONE,
      message_type: 'text' as MessageType,
      message_content: messageContent,
      contact_name: options?.contactName,
    };

    return scheduleMessage(data);
  }, [scheduleMessage]);

  const scheduleMediaMessage = useCallback(async (
    contactPhone: string,
    sendAt: string,
    mediaData: MediaData,
    options?: { contactName?: string; timezone?: string }
  ) => {
    const data: ScheduleMessageRequest = {
      contact_phone: contactPhone,
      send_at: sendAt,
      timezone: options?.timezone || DEFAULT_TIMEZONE,
      message_type: 'media' as MessageType,
      media_data: mediaData,
      contact_name: options?.contactName,
    };

    return scheduleMessage(data);
  }, [scheduleMessage]);

  const scheduleBulkMessages = useCallback(async (
    contacts: SchedulingContact[],
    messageData: Omit<ScheduleBulkMessagesRequest, 'contacts'>
  ) => {
    setLoading(true);
    setError(null);

    try {
      const request: ScheduleBulkMessagesRequest = {
        contacts,
        ...messageData,
        timezone: messageData.timezone || DEFAULT_TIMEZONE,
      };

      const response = await schedulingService.scheduleBulkMessages(request);

      if (response.reaction === 1) {
        const { scheduled_count, failed_count } = response.data;
        if (failed_count > 0) {
          toast.warning(`Scheduled ${scheduled_count} messages, ${failed_count} failed`);
        } else {
          toast.success(`Successfully scheduled ${scheduled_count} messages`);
        }
        return { success: true, data: response.data };
      } else {
        const errorMsg = response.message || 'Failed to schedule bulk messages';
        setError(errorMsg);
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (err) {
      const errorMsg = handleError(err);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const cancelMessage = useCallback(async (messageUid: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await schedulingService.cancelMessage(messageUid);

      if (response.reaction === 1) {
        toast.success(response.message || 'Message cancelled successfully');
        // Remove from local state
        setScheduledMessages(prev => prev.filter(m => m._uid !== messageUid));
        return { success: true };
      } else {
        const errorMsg = response.message || 'Failed to cancel message';
        setError(errorMsg);
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (err) {
      const errorMsg = handleError(err);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const getScheduledMessages = useCallback(async (status?: MessageStatusFilter) => {
    setLoading(true);
    setError(null);

    try {
      const response = await schedulingService.getScheduledMessages({
        status: schedulingService.getMessageStatusParam(status) as MessageStatusFilter,
      });

      if (response.reaction === 1) {
        // Ensure data is always an array
        const messages = Array.isArray(response.data) ? response.data : [];
        setScheduledMessages(messages);
        return { success: true, data: messages };
      } else {
        const errorMsg = response.message || 'Failed to fetch scheduled messages';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (err) {
      const errorMsg = handleError(err, false);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const getScheduledMessage = useCallback(async (messageUid: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await schedulingService.getScheduledMessage(messageUid);

      if (response.reaction === 1) {
        return { success: true, data: response.data };
      } else {
        const errorMsg = response.message || 'Failed to fetch scheduled message';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (err) {
      const errorMsg = handleError(err, false);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  // ==================== STATS & HEALTH ====================

  const getQueueStats = useCallback(async () => {
    try {
      const response = await schedulingService.getQueueStats();

      if (response.reaction === 1) {
        setQueueStats(response.data);
        return { success: true, data: response.data };
      } else {
        const errorMsg = response.message || 'Failed to fetch queue stats';
        return { success: false, error: errorMsg };
      }
    } catch (err) {
      const errorMsg = handleError(err, false);
      return { success: false, error: errorMsg };
    }
  }, [handleError]);

  const getHealth = useCallback(async () => {
    try {
      const response = await schedulingService.getHealth();

      if (response.reaction === 1) {
        setHealthStatus(response.data);
        return { success: true, data: response.data };
      } else {
        const errorMsg = response.message || 'Failed to fetch health status';
        return { success: false, error: errorMsg };
      }
    } catch (err) {
      const errorMsg = handleError(err, false);
      return { success: false, error: errorMsg };
    }
  }, [handleError]);

  // ==================== REMINDER CONFIGS ====================

  const saveReminderConfig = useCallback(async (config: SaveReminderConfigRequest) => {
    setLoading(true);
    setError(null);

    try {
      const response = await schedulingService.saveReminderConfig(config);

      if (response.reaction === 1) {
        toast.success(response.message || 'Reminder config saved successfully');
        // Update local state
        setReminderConfigs(prev => {
          const existingIndex = prev.findIndex(c => c._uid === response.data._uid);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = response.data;
            return updated;
          }
          return [...prev, response.data];
        });
        return { success: true, data: response.data };
      } else {
        const errorMsg = response.message || 'Failed to save reminder config';
        setError(errorMsg);
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (err) {
      const errorMsg = handleError(err);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const getReminderConfigs = useCallback(async (eventType?: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await schedulingService.getReminderConfigs(eventType);

      if (response.reaction === 1) {
        // Ensure data is always an array
        const configs = Array.isArray(response.data) ? response.data : [];
        setReminderConfigs(configs);
        return { success: true, data: configs };
      } else {
        const errorMsg = response.message || 'Failed to fetch reminder configs';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (err) {
      const errorMsg = handleError(err, false);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const deleteReminderConfig = useCallback(async (configUid: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await schedulingService.deleteReminderConfig(configUid);

      if (response.reaction === 1) {
        toast.success(response.message || 'Reminder config deleted successfully');
        // Remove from local state
        setReminderConfigs(prev => prev.filter(c => c._uid !== configUid));
        return { success: true };
      } else {
        const errorMsg = response.message || 'Failed to delete reminder config';
        setError(errorMsg);
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (err) {
      const errorMsg = handleError(err);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  // ==================== UTILITIES ====================

  const refreshAll = useCallback(async () => {
    await Promise.all([
      getScheduledMessages('scheduled'),
      getScheduledEvents('active'),
      getReminderConfigs(),
      getQueueStats(),
      getHealth(),
    ]);
  }, [getScheduledMessages, getScheduledEvents, getReminderConfigs, getQueueStats, getHealth]);

  return {
    // Event scheduling
    scheduleEvent,
    cancelEvent,
    getScheduledEvents,

    // Message scheduling
    scheduleMessage,
    scheduleTemplateMessage,
    scheduleTextMessage,
    scheduleMediaMessage,
    scheduleBulkMessages,
    cancelMessage,
    getScheduledMessages,
    getScheduledMessage,

    // Stats & Health
    getQueueStats,
    getHealth,

    // Reminder configs
    saveReminderConfig,
    getReminderConfigs,
    deleteReminderConfig,

    // State
    loading,
    error,
    scheduledMessages,
    scheduledEvents,
    reminderConfigs,
    queueStats,
    healthStatus,

    // Utilities
    isVendorConfigured,
    clearError,
    refreshAll,
  };
}

export default useScheduling;
