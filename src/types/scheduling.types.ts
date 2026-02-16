// ==================== SCHEDULING TYPES ====================
// Types for WhatsApp message scheduling system

// ==================== STATUS ENUMS ====================

export enum MessageStatus {
  SCHEDULED = 1,
  SENT = 2,
  FAILED = 3,
  CANCELLED = 4,
}

export enum EventStatus {
  ACTIVE = 1,
  CANCELLED = 2,
  COMPLETED = 3,
}

export enum MessageType {
  TEMPLATE = 'template',
  TEXT = 'text',
  MEDIA = 'media',
  INTERACTIVE = 'interactive',
}

export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  DOCUMENT = 'document',
  AUDIO = 'audio',
}

// ==================== CONTACT TYPES ====================

export interface SchedulingContact {
  phone: string;
  name?: string;
  params?: Record<string, string>;
}

// ==================== SCHEDULED MESSAGE TYPES ====================

export interface ScheduledMessage {
  _uid: string;
  contact_phone: string;
  contact_name?: string;
  send_at: string;
  message_type: MessageType;
  template_name?: string;
  template_language?: string;
  template_params?: Record<string, string>;
  message_content?: string;
  media_data?: MediaData;
  status: MessageStatus;
  formatted_send_time?: string;
  created_at?: string;
  updated_at?: string;
  sent_at?: string;
  error_message?: string;
  retry_count?: number;
}

export interface MediaData {
  type: MediaType;
  url: string;
  caption?: string;
  filename?: string;
}

// ==================== SCHEDULED EVENT TYPES ====================

export interface ScheduledEvent {
  _uid: string;
  event_type: string;
  contact_phone: string;
  contact_name?: string;
  event_at: string;
  timezone: string;
  metadata?: Record<string, unknown>;
  status: EventStatus;
  created_at?: string;
  updated_at?: string;
  scheduled_messages?: ScheduledMessage[];
}

// ==================== REMINDER CONFIG TYPES ====================

export interface ReminderConfig {
  _uid?: string;
  event_type: string;
  reminder_offset_minutes: number;
  template_name: string;
  template_language: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// ==================== QUEUE STATS TYPES ====================

export interface QueueStats {
  scheduled: number;
  sent: number;
  failed: number;
  cancelled: number;
  total: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  last_check?: string;
  queue_size?: number;
  processing_rate?: number;
}

// ==================== API REQUEST TYPES ====================

export interface ScheduleEventRequest {
  event_type: string;
  contact_phone: string;
  contact_name?: string;
  event_at: string;
  timezone?: string;
  metadata?: Record<string, unknown>;
}

export interface ScheduleMessageRequest {
  contact_phone: string;
  contact_name?: string;
  send_at: string;
  timezone?: string;
  message_type: MessageType;
  template_name?: string;
  template_language?: string;
  template_params?: Record<string, string>;
  message_content?: string;
  media_data?: MediaData;
}

export interface ScheduleBulkMessagesRequest {
  contacts: SchedulingContact[];
  send_at: string;
  timezone?: string;
  message_type: MessageType;
  template_name?: string;
  template_language?: string;
  template_params?: Record<string, string>;
  message_content?: string;
  media_data?: MediaData;
}

export interface SaveReminderConfigRequest {
  event_type: string;
  reminder_offset_minutes: number;
  template_name: string;
  template_language: string;
  is_active?: boolean;
}

// ==================== API RESPONSE TYPES ====================

export interface ApiResponse<T> {
  reaction: number;
  data: T;
  message?: string;
}

export interface ScheduleEventResponse {
  event: ScheduledEvent;
  scheduled_messages: ScheduledMessage[];
}

export interface ScheduleBulkMessagesResponse {
  scheduled_count: number;
  failed_count: number;
  messages: ScheduledMessage[];
  errors?: Array<{
    phone: string;
    error: string;
  }>;
}

// ==================== FILTER & QUERY TYPES ====================

export type MessageStatusFilter = 'scheduled' | 'sent' | 'failed' | 'cancelled' | 'all';
export type EventStatusFilter = 'active' | 'cancelled' | 'completed' | 'all';

export interface ScheduledMessagesQuery {
  status?: MessageStatusFilter;
  contact_phone?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}

export interface ScheduledEventsQuery {
  status?: EventStatusFilter;
  event_type?: string;
  contact_phone?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}

// ==================== HOOK STATE TYPES ====================

export interface SchedulingState {
  loading: boolean;
  error: string | null;
  scheduledMessages: ScheduledMessage[];
  scheduledEvents: ScheduledEvent[];
  reminderConfigs: ReminderConfig[];
  queueStats: QueueStats | null;
  healthStatus: HealthStatus | null;
}

// ==================== SCHEDULE REMINDER HELPER TYPES ====================

export interface ScheduleReminderOptions {
  type: string;
  contact: {
    phone: string;
    name?: string;
  };
  appointmentTime: string;
  timezone?: string;
  metadata?: Record<string, unknown>;
}
