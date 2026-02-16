// ==================== SCHEDULE HELPERS ====================
// Utility functions for WhatsApp message scheduling

import { schedulingService } from '@/services/schedulingService';
import {
  DEFAULT_TIMEZONE,
  MESSAGE_STATUS,
  EVENT_STATUS,
  MESSAGE_STATUS_LABELS,
  EVENT_STATUS_LABELS,
  MESSAGE_STATUS_COLORS,
  EVENT_STATUS_COLORS,
  SCHEDULING_CONSTRAINTS,
} from '@/constants/scheduling';
import type {
  ScheduleReminderOptions,
  ScheduleEventRequest,
  MessageStatus,
  EventStatus,
} from '@/types/scheduling.types';

// ==================== SCHEDULE REMINDER ====================

/**
 * Simplified helper function to schedule a reminder event
 * This auto-creates reminders based on backend configuration
 *
 * @example
 * await scheduleReminder({
 *   type: 'followup_appointment',
 *   contact: {
 *     phone: '+919876543210',
 *     name: 'John Doe'
 *   },
 *   appointmentTime: '2026-02-07T10:00:00',
 *   timezone: 'Asia/Kolkata',
 *   metadata: {
 *     doctor_name: 'Dr. Smith',
 *     clinic: 'City Hospital'
 *   }
 * });
 */
export async function scheduleReminder(options: ScheduleReminderOptions): Promise<{
  success: boolean;
  eventUid?: string;
  scheduledMessages?: number;
  error?: string;
}> {
  try {
    const request: ScheduleEventRequest = {
      event_type: options.type,
      contact_phone: options.contact.phone,
      contact_name: options.contact.name,
      event_at: options.appointmentTime,
      timezone: options.timezone || DEFAULT_TIMEZONE,
      metadata: options.metadata,
    };

    const response = await schedulingService.scheduleEvent(request);

    if (response.reaction === 1) {
      return {
        success: true,
        eventUid: response.data.event._uid,
        scheduledMessages: response.data.scheduled_messages.length,
      };
    }

    return {
      success: false,
      error: response.message || 'Failed to schedule reminder',
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ==================== DATE/TIME UTILITIES ====================

/**
 * Convert date to ISO string for API
 */
export function toISOString(date: Date | string): string {
  if (typeof date === 'string') {
    return date;
  }
  return date.toISOString();
}

/**
 * Format date for display
 */
export function formatScheduleDate(dateString: string, options?: Intl.DateTimeFormatOptions): string {
  const date = new Date(dateString);
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  };
  return date.toLocaleDateString(undefined, defaultOptions);
}

/**
 * Get relative time string (e.g., "in 2 hours", "3 days ago")
 */
export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffSeconds = Math.floor(Math.abs(diffMs) / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  const isFuture = diffMs > 0;
  const prefix = isFuture ? 'in ' : '';
  const suffix = isFuture ? '' : ' ago';

  if (diffDays > 0) {
    return `${prefix}${diffDays} day${diffDays > 1 ? 's' : ''}${suffix}`;
  }
  if (diffHours > 0) {
    return `${prefix}${diffHours} hour${diffHours > 1 ? 's' : ''}${suffix}`;
  }
  if (diffMinutes > 0) {
    return `${prefix}${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}${suffix}`;
  }
  return 'just now';
}

/**
 * Check if a date is in the past
 */
export function isPastDate(dateString: string): boolean {
  return new Date(dateString).getTime() < Date.now();
}

/**
 * Check if schedule time is valid (not too soon, not too far)
 */
export function isValidScheduleTime(dateString: string): {
  valid: boolean;
  error?: string;
} {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < SCHEDULING_CONSTRAINTS.MIN_SCHEDULE_AHEAD_MINUTES) {
    return {
      valid: false,
      error: `Schedule time must be at least ${SCHEDULING_CONSTRAINTS.MIN_SCHEDULE_AHEAD_MINUTES} minutes in the future`,
    };
  }

  if (diffDays > SCHEDULING_CONSTRAINTS.MAX_SCHEDULE_AHEAD_DAYS) {
    return {
      valid: false,
      error: `Schedule time cannot be more than ${SCHEDULING_CONSTRAINTS.MAX_SCHEDULE_AHEAD_DAYS} days in the future`,
    };
  }

  return { valid: true };
}

/**
 * Get minimum valid schedule date (now + MIN_SCHEDULE_AHEAD_MINUTES)
 */
export function getMinScheduleDate(): Date {
  const date = new Date();
  date.setMinutes(date.getMinutes() + SCHEDULING_CONSTRAINTS.MIN_SCHEDULE_AHEAD_MINUTES);
  return date;
}

/**
 * Get maximum valid schedule date (now + MAX_SCHEDULE_AHEAD_DAYS)
 */
export function getMaxScheduleDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + SCHEDULING_CONSTRAINTS.MAX_SCHEDULE_AHEAD_DAYS);
  return date;
}

// ==================== STATUS UTILITIES ====================

/**
 * Get message status label
 */
export function getMessageStatusLabel(status: number): string {
  return MESSAGE_STATUS_LABELS[status] || 'Unknown';
}

/**
 * Get event status label
 */
export function getEventStatusLabel(status: number): string {
  return EVENT_STATUS_LABELS[status] || 'Unknown';
}

/**
 * Get message status color
 */
export function getMessageStatusColor(status: number): string {
  return MESSAGE_STATUS_COLORS[status] || 'gray';
}

/**
 * Get event status color
 */
export function getEventStatusColor(status: number): string {
  return EVENT_STATUS_COLORS[status] || 'gray';
}

/**
 * Check if message can be cancelled
 */
export function canCancelMessage(status: number): boolean {
  return status === MESSAGE_STATUS.SCHEDULED;
}

/**
 * Check if event can be cancelled
 */
export function canCancelEvent(status: number): boolean {
  return status === EVENT_STATUS.ACTIVE;
}

// ==================== PHONE NUMBER UTILITIES ====================

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');

  // If it starts with +, keep it as is
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // If it starts with 91 (India), add +
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return `+${cleaned}`;
  }

  return cleaned;
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');

  // Check if it's a valid international format
  // Should start with + and have 10-15 digits after country code
  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1);
    return digits.length >= 10 && digits.length <= 15 && /^\d+$/.test(digits);
  }

  // Check if it's a valid format without + (assume India)
  return cleaned.length >= 10 && cleaned.length <= 15 && /^\d+$/.test(cleaned);
}

// ==================== REMINDER OFFSET UTILITIES ====================

/**
 * Convert reminder offset to human readable string
 */
export function formatReminderOffset(offsetMinutes: number): string {
  const absMinutes = Math.abs(offsetMinutes);
  const isBefore = offsetMinutes < 0;
  const suffix = isBefore ? 'before' : 'after';

  if (absMinutes === 0) {
    return 'At event time';
  }

  if (absMinutes < 60) {
    return `${absMinutes} minute${absMinutes > 1 ? 's' : ''} ${suffix}`;
  }

  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;

  if (hours < 24) {
    if (minutes === 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ${suffix}`;
    }
    return `${hours}h ${minutes}m ${suffix}`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (remainingHours === 0) {
    return `${days} day${days > 1 ? 's' : ''} ${suffix}`;
  }
  return `${days}d ${remainingHours}h ${suffix}`;
}

/**
 * Calculate the send time based on event time and offset
 */
export function calculateSendTime(eventTime: string | Date, offsetMinutes: number): Date {
  const eventDate = typeof eventTime === 'string' ? new Date(eventTime) : eventTime;
  const sendDate = new Date(eventDate.getTime() + offsetMinutes * 60 * 1000);
  return sendDate;
}

// ==================== BULK SCHEDULING UTILITIES ====================

/**
 * Validate contacts array for bulk scheduling
 */
export function validateBulkContacts(contacts: Array<{ phone: string; name?: string }>): {
  valid: boolean;
  errors: string[];
  validCount: number;
  invalidCount: number;
} {
  const errors: string[] = [];
  let validCount = 0;
  let invalidCount = 0;

  if (!contacts || contacts.length === 0) {
    return {
      valid: false,
      errors: ['No contacts provided'],
      validCount: 0,
      invalidCount: 0,
    };
  }

  if (contacts.length > SCHEDULING_CONSTRAINTS.MAX_BULK_CONTACTS) {
    return {
      valid: false,
      errors: [`Maximum ${SCHEDULING_CONSTRAINTS.MAX_BULK_CONTACTS} contacts allowed`],
      validCount: 0,
      invalidCount: contacts.length,
    };
  }

  contacts.forEach((contact, index) => {
    if (!contact.phone) {
      errors.push(`Contact ${index + 1}: Phone number is required`);
      invalidCount++;
    } else if (!isValidPhoneNumber(contact.phone)) {
      errors.push(`Contact ${index + 1}: Invalid phone number format`);
      invalidCount++;
    } else {
      validCount++;
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    validCount,
    invalidCount,
  };
}
