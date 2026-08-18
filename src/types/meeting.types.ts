/**
 * Meeting type definitions matching Django backend
 */

import { Lead } from './crmTypes';

/**
 * Main Meeting interface - matches Django Meeting model
 */
export interface Meeting {
  id: number;
  tenant_id?: string;
  uid?: string;
  lead: number | null;
  lead_name?: string; // Read-only field from serializer
  title: string;
  location: string | null;
  description: string | null;
  notes: string | null;
  start_at: string; // UTC ISO datetime string
  end_at: string; // UTC ISO datetime string
  owner_user_id?: string;
  created_at: string;
  updated_at: string;

  // --- Calendar fields (see _plans/06-calendar-meetings.md §A.2) -----------
  // All optional: the backend that adds them is being built in parallel, so a
  // response from the current API still satisfies this type.
  /** All-day events are a distinct rendering mode, not 00:00 -> 23:59. */
  all_day?: boolean;
  /** IANA zone the meeting was authored in. Authoritative for all-day bucketing. */
  timezone?: string | null;
  meeting_type?: MeetingType | null;
  status?: MeetingStatus | null;
  visibility?: MeetingVisibility | null;
  transparency?: MeetingTransparency | null;
  conference_url?: string | null;
  color_key?: string | null;
  /** Bare RFC 5545 rule text, e.g. `FREQ=WEEKLY;BYDAY=TU;COUNT=8`. */
  recurrence_rule?: string | null;
  recurrence_end_at?: string | null;
  recurrence_exdates?: string[] | null;
  recurring_parent?: number | null;
  recurrence_original_start?: string | null;
  occurrence_count?: number | null;
  attendees?: MeetingAttendee[];
  reminder_rules?: MeetingReminderRule[];
  completed_at?: string | null;
  cancelled_reason?: string | null;
  is_deleted?: boolean;
  sync_status?: string | null;
}

export type MeetingType =
  | 'MEETING'
  | 'DEMO'
  | 'CALL'
  | 'SITE_VISIT'
  | 'INTERNAL'
  | 'OTHER';

export type MeetingStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'NO_SHOW';

export type MeetingVisibility = 'DEFAULT' | 'PRIVATE' | 'PUBLIC';
export type MeetingTransparency = 'OPAQUE' | 'TRANSPARENT';
export type MeetingAttendeeRole = 'ORGANIZER' | 'REQUIRED' | 'OPTIONAL';
export type MeetingAttendeeResponse =
  | 'NEEDS_ACTION'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'TENTATIVE';

export interface MeetingAttendee {
  id?: number;
  /** Tenant user (SuperAdmin UUID), a lead, or a free-text external email. */
  user_id?: string | null;
  lead?: number | null;
  email?: string | null;
  display_name?: string | null;
  role?: MeetingAttendeeRole | null;
  response_status?: MeetingAttendeeResponse | null;
  is_organizer?: boolean;
  comment?: string | null;
}

export interface MeetingReminderRule {
  id?: number;
  minutes_before: number;
  method?: 'IN_APP' | 'EMAIL' | 'WHATSAPP' | null;
  for_attendees?: boolean;
}

/** Recurrence edit semantics carried by every mutation on a series (§B.3). */
export type MeetingEditScope = 'this' | 'this_and_following' | 'all';

export interface MeetingEditOptions {
  editScope?: MeetingEditScope;
  /** UTC start of the clicked occurrence; required unless scope is `all`. */
  occurrenceStart?: string | null;
}

/** Response shape of a `this_and_following` split (§B.3). */
export interface MeetingSplitResponse {
  updated: Meeting;
  created?: Meeting;
  edit_scope: MeetingEditScope;
}

/**
 * Meeting list parameters for filtering and searching
 */
export interface MeetingListParams {
  page?: number;
  page_size?: number;
  search?: string;
  lead?: number;
  start_at__gte?: string;
  start_at__lte?: string;
  end_at__gte?: string;
  end_at__lte?: string;
  created_at__gte?: string;
  created_at__lte?: string;
  ordering?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Meeting create payload - matches backend serializer requirements
 */
export interface MeetingCreateData {
  title: string; // Required
  start_at: string; // Required - UTC ISO datetime string
  end_at: string; // Required - UTC ISO datetime string
  lead?: number | null; // Optional
  location?: string; // Optional
  description?: string; // Optional
  notes?: string; // Optional
  all_day?: boolean;
  timezone?: string;
  meeting_type?: MeetingType;
  visibility?: MeetingVisibility;
  transparency?: MeetingTransparency;
  conference_url?: string;
  owner_user_id?: string;
  recurrence_rule?: string | null;
  attendees?: MeetingAttendee[];
  reminder_rules?: MeetingReminderRule[];
}

/**
 * Meeting update payload - all fields optional
 */
export interface MeetingUpdateData {
  title?: string;
  start_at?: string;
  end_at?: string;
  lead?: number | null;
  location?: string;
  description?: string;
  notes?: string;
  all_day?: boolean;
  timezone?: string;
  meeting_type?: MeetingType;
  status?: MeetingStatus;
  visibility?: MeetingVisibility;
  transparency?: MeetingTransparency;
  conference_url?: string;
  owner_user_id?: string;
  recurrence_rule?: string | null;
  attendees?: MeetingAttendee[];
  reminder_rules?: MeetingReminderRule[];
}

/**
 * Paginated response wrapper
 */
export interface PaginatedMeetingResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Meeting[];
}

/*
 * NOTE — the legacy `MeetingCalendarData` / `MeetingCalendarParams` types and
 * the `meetingService.getCalendarData()` / `useMeetingCalendar()` client they
 * fed were removed: they had zero call sites and bucketed events by UTC date,
 * which put an IST user's 02:00 meeting on the wrong day. The calendar now runs
 * on the unified `/api/calendar/events/` feed — see `@/types/calendar.types`.
 */

/**
 * Form validation errors
 */
export interface MeetingFormErrors {
  title?: string;
  start_at?: string;
  end_at?: string;
  lead?: string;
  location?: string;
  description?: string;
  notes?: string;
}
