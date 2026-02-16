// ==================== SCHEDULING SERVICE ====================
// API service for WhatsApp message scheduling

import { externalWhatsappClient, buildExternalWhatsAppUrl, getVendorUid } from '@/lib/externalWhatsappClient';
import { SCHEDULING_ENDPOINTS } from '@/constants/scheduling';
import type {
  ApiResponse,
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
  ScheduledMessagesQuery,
  ScheduledEventsQuery,
  MessageStatusFilter,
  EventStatusFilter,
} from '@/types/scheduling.types';

class SchedulingService {
  // ==================== EVENT SCHEDULING ====================

  /**
   * Schedule an event with auto-reminders
   * Backend will automatically create reminder messages based on event_reminder_configs
   */
  async scheduleEvent(data: ScheduleEventRequest): Promise<ApiResponse<ScheduleEventResponse>> {
    const url = buildExternalWhatsAppUrl(SCHEDULING_ENDPOINTS.SCHEDULE_EVENT);
    const response = await externalWhatsappClient.post<ApiResponse<ScheduleEventResponse>>(url, data);
    return response.data;
  }

  /**
   * Get list of scheduled events
   */
  async getScheduledEvents(query?: ScheduledEventsQuery): Promise<ApiResponse<ScheduledEvent[]>> {
    const url = buildExternalWhatsAppUrl(SCHEDULING_ENDPOINTS.GET_SCHEDULED_EVENTS);
    const params = this.buildQueryParams(query);
    const response = await externalWhatsappClient.get<ApiResponse<ScheduledEvent[]>>(url, { params });
    return response.data;
  }

  /**
   * Cancel a scheduled event and its associated messages
   */
  async cancelEvent(eventUid: string): Promise<ApiResponse<null>> {
    const url = buildExternalWhatsAppUrl(SCHEDULING_ENDPOINTS.CANCEL_EVENT, { eventUid });
    const response = await externalWhatsappClient.delete<ApiResponse<null>>(url);
    return response.data;
  }

  // ==================== MESSAGE SCHEDULING ====================

  /**
   * Schedule a single message (template, text, or media)
   */
  async scheduleMessage(data: ScheduleMessageRequest): Promise<ApiResponse<ScheduledMessage>> {
    const url = buildExternalWhatsAppUrl(SCHEDULING_ENDPOINTS.SCHEDULE_MESSAGE);
    const response = await externalWhatsappClient.post<ApiResponse<ScheduledMessage>>(url, data);
    return response.data;
  }

  /**
   * Schedule bulk messages to multiple contacts
   */
  async scheduleBulkMessages(data: ScheduleBulkMessagesRequest): Promise<ApiResponse<ScheduleBulkMessagesResponse>> {
    const url = buildExternalWhatsAppUrl(SCHEDULING_ENDPOINTS.SCHEDULE_BULK_MESSAGES);
    const response = await externalWhatsappClient.post<ApiResponse<ScheduleBulkMessagesResponse>>(url, data);
    return response.data;
  }

  /**
   * Get list of scheduled messages
   */
  async getScheduledMessages(query?: ScheduledMessagesQuery): Promise<ApiResponse<ScheduledMessage[]>> {
    const url = buildExternalWhatsAppUrl(SCHEDULING_ENDPOINTS.GET_SCHEDULED_MESSAGES);
    const params = this.buildQueryParams(query);
    const response = await externalWhatsappClient.get<ApiResponse<ScheduledMessage[]>>(url, { params });
    return response.data;
  }

  /**
   * Get a single scheduled message by UID
   */
  async getScheduledMessage(messageUid: string): Promise<ApiResponse<ScheduledMessage>> {
    const url = buildExternalWhatsAppUrl(SCHEDULING_ENDPOINTS.GET_SCHEDULED_MESSAGE, { messageUid });
    const response = await externalWhatsappClient.get<ApiResponse<ScheduledMessage>>(url);
    return response.data;
  }

  /**
   * Cancel a scheduled message
   */
  async cancelMessage(messageUid: string): Promise<ApiResponse<null>> {
    const url = buildExternalWhatsAppUrl(SCHEDULING_ENDPOINTS.CANCEL_MESSAGE, { messageUid });
    const response = await externalWhatsappClient.delete<ApiResponse<null>>(url);
    return response.data;
  }

  // ==================== STATS & HEALTH ====================

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<ApiResponse<QueueStats>> {
    const url = buildExternalWhatsAppUrl(SCHEDULING_ENDPOINTS.GET_QUEUE_STATS);
    const response = await externalWhatsappClient.get<ApiResponse<QueueStats>>(url);
    return response.data;
  }

  /**
   * Get health status of the scheduling system
   */
  async getHealth(): Promise<ApiResponse<HealthStatus>> {
    const url = buildExternalWhatsAppUrl(SCHEDULING_ENDPOINTS.GET_HEALTH);
    const response = await externalWhatsappClient.get<ApiResponse<HealthStatus>>(url);
    return response.data;
  }

  // ==================== REMINDER CONFIGS (ADMIN) ====================

  /**
   * Save a reminder configuration
   */
  async saveReminderConfig(data: SaveReminderConfigRequest): Promise<ApiResponse<ReminderConfig>> {
    const url = buildExternalWhatsAppUrl(SCHEDULING_ENDPOINTS.SAVE_REMINDER_CONFIG);
    const response = await externalWhatsappClient.post<ApiResponse<ReminderConfig>>(url, data);
    return response.data;
  }

  /**
   * Get reminder configurations
   */
  async getReminderConfigs(eventType?: string): Promise<ApiResponse<ReminderConfig[]>> {
    const url = buildExternalWhatsAppUrl(SCHEDULING_ENDPOINTS.GET_REMINDER_CONFIGS);
    const params = eventType ? { event_type: eventType } : undefined;
    const response = await externalWhatsappClient.get<ApiResponse<ReminderConfig[]>>(url, { params });
    return response.data;
  }

  /**
   * Delete a reminder configuration
   */
  async deleteReminderConfig(configUid: string): Promise<ApiResponse<null>> {
    const url = buildExternalWhatsAppUrl(SCHEDULING_ENDPOINTS.DELETE_REMINDER_CONFIG, { configUid });
    const response = await externalWhatsappClient.delete<ApiResponse<null>>(url);
    return response.data;
  }

  // ==================== HELPER METHODS ====================

  /**
   * Build query parameters object, filtering out undefined/null values
   */
  private buildQueryParams(query?: Record<string, unknown>): Record<string, string> | undefined {
    if (!query) return undefined;

    const params: Record<string, string> = {};

    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params[key] = String(value);
      }
    });

    return Object.keys(params).length > 0 ? params : undefined;
  }

  /**
   * Check if vendor is configured for scheduling
   */
  isVendorConfigured(): boolean {
    return !!getVendorUid();
  }

  /**
   * Get status filter query param value
   */
  getMessageStatusParam(status?: MessageStatusFilter): string | undefined {
    if (!status || status === 'all') return undefined;
    return status;
  }

  /**
   * Get event status filter query param value
   */
  getEventStatusParam(status?: EventStatusFilter): string | undefined {
    if (!status || status === 'all') return undefined;
    return status;
  }
}

// Export singleton instance
export const schedulingService = new SchedulingService();
