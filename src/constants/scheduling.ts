// ==================== SCHEDULING CONSTANTS ====================
// Constants for WhatsApp message scheduling system

// ==================== STATUS CONSTANTS ====================

export const MESSAGE_STATUS = {
  SCHEDULED: 1,
  SENT: 2,
  FAILED: 3,
  CANCELLED: 4,
} as const;

export const EVENT_STATUS = {
  ACTIVE: 1,
  CANCELLED: 2,
  COMPLETED: 3,
} as const;

export const MESSAGE_TYPES = {
  TEMPLATE: 'template',
  TEXT: 'text',
  MEDIA: 'media',
  INTERACTIVE: 'interactive',
} as const;

export const MEDIA_TYPES = {
  IMAGE: 'image',
  VIDEO: 'video',
  DOCUMENT: 'document',
  AUDIO: 'audio',
} as const;

// ==================== STATUS LABELS ====================

export const MESSAGE_STATUS_LABELS: Record<number, string> = {
  [MESSAGE_STATUS.SCHEDULED]: 'Scheduled',
  [MESSAGE_STATUS.SENT]: 'Sent',
  [MESSAGE_STATUS.FAILED]: 'Failed',
  [MESSAGE_STATUS.CANCELLED]: 'Cancelled',
};

export const EVENT_STATUS_LABELS: Record<number, string> = {
  [EVENT_STATUS.ACTIVE]: 'Active',
  [EVENT_STATUS.CANCELLED]: 'Cancelled',
  [EVENT_STATUS.COMPLETED]: 'Completed',
};

// ==================== STATUS COLORS (for UI) ====================

export const MESSAGE_STATUS_COLORS: Record<number, string> = {
  [MESSAGE_STATUS.SCHEDULED]: 'blue',
  [MESSAGE_STATUS.SENT]: 'green',
  [MESSAGE_STATUS.FAILED]: 'red',
  [MESSAGE_STATUS.CANCELLED]: 'gray',
};

export const EVENT_STATUS_COLORS: Record<number, string> = {
  [EVENT_STATUS.ACTIVE]: 'blue',
  [EVENT_STATUS.CANCELLED]: 'gray',
  [EVENT_STATUS.COMPLETED]: 'green',
};

// ==================== COMMON REMINDER OFFSETS ====================
// Negative values = before event, Positive values = after event

export const REMINDER_OFFSETS = {
  ONE_WEEK_BEFORE: -10080,    // 7 days * 24 hours * 60 minutes
  THREE_DAYS_BEFORE: -4320,   // 3 days * 24 hours * 60 minutes
  ONE_DAY_BEFORE: -1440,      // 24 hours * 60 minutes
  TWELVE_HOURS_BEFORE: -720,  // 12 hours * 60 minutes
  SIX_HOURS_BEFORE: -360,     // 6 hours * 60 minutes
  TWO_HOURS_BEFORE: -120,     // 2 hours * 60 minutes
  ONE_HOUR_BEFORE: -60,       // 60 minutes
  THIRTY_MIN_BEFORE: -30,     // 30 minutes
  FIFTEEN_MIN_BEFORE: -15,    // 15 minutes
  AT_EVENT_TIME: 0,           // Exact time of event
  FIFTEEN_MIN_AFTER: 15,      // 15 minutes after
  THIRTY_MIN_AFTER: 30,       // 30 minutes after
  ONE_HOUR_AFTER: 60,         // 60 minutes after
  ONE_DAY_AFTER: 1440,        // 24 hours after
} as const;

export const REMINDER_OFFSET_OPTIONS = [
  { value: REMINDER_OFFSETS.ONE_WEEK_BEFORE, label: '1 week before' },
  { value: REMINDER_OFFSETS.THREE_DAYS_BEFORE, label: '3 days before' },
  { value: REMINDER_OFFSETS.ONE_DAY_BEFORE, label: '1 day before' },
  { value: REMINDER_OFFSETS.TWELVE_HOURS_BEFORE, label: '12 hours before' },
  { value: REMINDER_OFFSETS.SIX_HOURS_BEFORE, label: '6 hours before' },
  { value: REMINDER_OFFSETS.TWO_HOURS_BEFORE, label: '2 hours before' },
  { value: REMINDER_OFFSETS.ONE_HOUR_BEFORE, label: '1 hour before' },
  { value: REMINDER_OFFSETS.THIRTY_MIN_BEFORE, label: '30 minutes before' },
  { value: REMINDER_OFFSETS.FIFTEEN_MIN_BEFORE, label: '15 minutes before' },
  { value: REMINDER_OFFSETS.AT_EVENT_TIME, label: 'At event time' },
  { value: REMINDER_OFFSETS.FIFTEEN_MIN_AFTER, label: '15 minutes after' },
  { value: REMINDER_OFFSETS.THIRTY_MIN_AFTER, label: '30 minutes after' },
  { value: REMINDER_OFFSETS.ONE_HOUR_AFTER, label: '1 hour after' },
  { value: REMINDER_OFFSETS.ONE_DAY_AFTER, label: '1 day after' },
];

// ==================== COMMON EVENT TYPES ====================

export const EVENT_TYPES = {
  FOLLOWUP_APPOINTMENT: 'followup_appointment',
  NEW_APPOINTMENT: 'new_appointment',
  PRESCRIPTION_REFILL: 'prescription_refill',
  LAB_RESULT_READY: 'lab_result_ready',
  PAYMENT_REMINDER: 'payment_reminder',
  BIRTHDAY_GREETING: 'birthday_greeting',
  PROMOTIONAL: 'promotional',
  CUSTOM: 'custom',
} as const;

export const EVENT_TYPE_OPTIONS = [
  { value: EVENT_TYPES.FOLLOWUP_APPOINTMENT, label: 'Follow-up Appointment' },
  { value: EVENT_TYPES.NEW_APPOINTMENT, label: 'New Appointment' },
  { value: EVENT_TYPES.PRESCRIPTION_REFILL, label: 'Prescription Refill' },
  { value: EVENT_TYPES.LAB_RESULT_READY, label: 'Lab Result Ready' },
  { value: EVENT_TYPES.PAYMENT_REMINDER, label: 'Payment Reminder' },
  { value: EVENT_TYPES.BIRTHDAY_GREETING, label: 'Birthday Greeting' },
  { value: EVENT_TYPES.PROMOTIONAL, label: 'Promotional' },
  { value: EVENT_TYPES.CUSTOM, label: 'Custom Event' },
];

// ==================== COMMON TIMEZONES ====================

export const COMMON_TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST)' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time (GST)' },
  { value: 'Asia/Singapore', label: 'Singapore Time (SGT)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' },
  { value: 'UTC', label: 'UTC' },
];

// ==================== DEFAULT VALUES ====================

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';
export const DEFAULT_TEMPLATE_LANGUAGE = 'en';

// ==================== API ENDPOINTS ====================

export const SCHEDULING_ENDPOINTS = {
  // Event scheduling
  SCHEDULE_EVENT: '/:vendorUid/events/schedule',
  GET_SCHEDULED_EVENTS: '/:vendorUid/events/scheduled',
  CANCEL_EVENT: '/:vendorUid/events/:eventUid',

  // Message scheduling
  SCHEDULE_MESSAGE: '/:vendorUid/messages/schedule',
  SCHEDULE_BULK_MESSAGES: '/:vendorUid/messages/schedule-bulk',
  GET_SCHEDULED_MESSAGES: '/:vendorUid/messages/scheduled',
  GET_SCHEDULED_MESSAGE: '/:vendorUid/messages/scheduled/:messageUid',
  CANCEL_MESSAGE: '/:vendorUid/messages/scheduled/:messageUid',

  // Stats & Health
  GET_QUEUE_STATS: '/:vendorUid/scheduling/stats',
  GET_HEALTH: '/:vendorUid/scheduling/health',

  // Reminder configs
  SAVE_REMINDER_CONFIG: '/:vendorUid/scheduling/reminder-configs',
  GET_REMINDER_CONFIGS: '/:vendorUid/scheduling/reminder-configs',
  DELETE_REMINDER_CONFIG: '/:vendorUid/scheduling/reminder-configs/:configUid',
} as const;

// ==================== VALIDATION CONSTRAINTS ====================

export const SCHEDULING_CONSTRAINTS = {
  MIN_SCHEDULE_AHEAD_MINUTES: 5,   // Minimum 5 minutes in the future
  MAX_SCHEDULE_AHEAD_DAYS: 365,    // Maximum 1 year in the future
  MAX_BULK_CONTACTS: 1000,         // Maximum contacts in bulk schedule
  MAX_RETRY_COUNT: 3,              // Maximum retry attempts for failed messages
  RETRY_INTERVAL_MINUTES: 5,       // Time between retries
} as const;
