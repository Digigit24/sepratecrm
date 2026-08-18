/**
 * Calendar type definitions.
 *
 * These mirror the `/api/calendar/` contracts specified in
 * `_plans/06-calendar-meetings.md` §B.2 (endpoints 13-19). The backend for
 * those endpoints is being built in parallel; every consumer in this app must
 * therefore treat a 404/501 from them as "not available yet" and degrade, not
 * crash. See `calendarService` for the degradation contract.
 */

/** Which underlying record a calendar item came from. */
export type CalendarEventSource = 'meeting' | 'task' | 'follow_up' | 'activity';

/** Toggleable feed layers. Mirrors the `layers` query param of endpoint 13. */
export type CalendarLayer = 'meetings' | 'tasks' | 'follow_ups' | 'activities';

/** The rendering modes of the calendar page. */
export type CalendarView = 'month' | 'week' | 'day' | 'agenda';

/** Admin team-calendar rendering mode. */
export type TeamMode = 'off' | 'lanes' | 'overlay';

/** RFC-5545-ish edit semantics for a recurring series (§B.3). */
export type RecurrenceEditScope = 'this' | 'this_and_following' | 'all';

export type AttendeeResponse = 'NEEDS_ACTION' | 'ACCEPTED' | 'DECLINED' | 'TENTATIVE';

export type MeetingStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'TENTATIVE'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'NO_SHOW';

export type MeetingVisibility = 'DEFAULT' | 'PRIVATE' | 'PUBLIC';

export type MeetingTransparency = 'OPAQUE' | 'TRANSPARENT';

export type MeetingType =
  | 'MEETING'
  | 'DEMO'
  | 'CALL'
  | 'SITE_VISIT'
  | 'FOLLOW_UP'
  | 'INTERNAL'
  | 'OTHER';

/** Keys of `CALENDAR_COLORS` in `@/lib/calendarColors`. */
export type CalendarColorKey =
  | 'meeting'
  | 'demo'
  | 'call'
  | 'site_visit'
  | 'internal'
  | 'task'
  | 'follow_up'
  | 'activity'
  | 'cancelled'
  /** Stamped by the server on a redacted PRIVATE event. */
  | 'busy';

/**
 * NOTE: the two APIs disagree on one key. `/api/calendar/events/` emits
 * `lead_id`, while `/api/meetings/` emits `lead` — so both are declared here
 * and neither is relied on alone.
 */
export interface CalendarEventAttendee {
  id?: number;
  user_id?: string | null;
  lead_id?: number | null;
  lead?: number | null;
  email?: string | null;
  display_name?: string | null;
  role?: 'ORGANIZER' | 'REQUIRED' | 'OPTIONAL' | null;
  response_status?: AttendeeResponse | null;
  is_organizer?: boolean;
}

export interface CalendarEventLead {
  id: number;
  name: string;
}

export interface CalendarAttendeeSummary {
  accepted: number;
  declined: number;
  tentative: number;
  needs_action: number;
}

/**
 * The normalised envelope returned by `GET /api/calendar/events/`.
 *
 * IMPORTANT — redaction. When `redacted` is true the server has already
 * stripped `description` / `location` / `attendees` / `lead` and replaced the
 * title with "Busy" because the event's `visibility` is `PRIVATE` and the
 * viewer is neither the owner nor an attendee. The UI must ALSO fail closed on
 * its own (see `isRedacted()` in `@/lib/calendarColors`) so that a
 * mis-configured or older backend can never leak a private title into the grid,
 * a team lane, or a hover card.
 */
export interface CalendarEvent {
  /** Stable React key, e.g. `meeting:1234:2026-09-08T09:30:00Z`. */
  id: string;
  source: CalendarEventSource;
  source_id: number;
  series_id?: number | null;
  uid?: string | null;

  /** UTC instant of this occurrence's start (recurring events only). */
  occurrence_start?: string | null;
  is_recurring?: boolean;
  is_override?: boolean;

  title: string;
  description?: string | null;
  location?: string | null;
  conference_url?: string | null;

  /** UTC ISO-8601 instant. NEVER format this with plain date-fns. */
  start_at: string;
  /** UTC ISO-8601 instant, exclusive for all-day events. */
  end_at: string;
  all_day: boolean;
  /** IANA zone the event was authored in. Authoritative for all-day bucketing. */
  timezone?: string | null;

  status?: MeetingStatus | string | null;
  transparency?: MeetingTransparency | null;
  visibility?: MeetingVisibility | null;
  meeting_type?: MeetingType | string | null;
  priority?: string | null;

  color_key?: CalendarColorKey | string | null;

  owner_user_id?: string | null;
  owner_name?: string | null;
  assignee_user_id?: string | null;
  /** `task` events only. */
  due_at?: string | null;
  /** `follow_up` events only. */
  assigned_to?: string | null;

  attendees?: CalendarEventAttendee[];
  attendee_summary?: CalendarAttendeeSummary | null;
  my_response?: AttendeeResponse | null;

  lead?: CalendarEventLead | null;

  has_reminders?: boolean;
  redacted?: boolean;

  /** Server-computed entitlements. Never re-derive scope for team rows. */
  can_edit?: boolean;
  can_delete?: boolean;
}

export interface CalendarRangeParams {
  /** Inclusive window start, ISO-8601 with offset. */
  start: string;
  /** Exclusive window end, ISO-8601 with offset. */
  end: string;
  /** IANA zone used for day bucketing / all-day resolution. */
  tz?: string;
  user_ids?: string[];
  layers?: CalendarLayer[];
  meeting_types?: string[];
  include_cancelled?: boolean;
  include_declined?: boolean;
  expand_recurring?: boolean;
}

export interface CalendarRangeResponse {
  range: { start: string; end: string; timezone: string };
  /** Shorthand for `layer_scopes.meetings`; null when meetings were not requested. */
  scope?: 'all' | 'team' | 'own' | null;
  /** Per-layer permission scope, only for the layers actually requested. */
  layer_scopes?: Partial<Record<CalendarLayer, 'all' | 'team' | 'own' | null>>;
  /** Server-side cap (5000); `truncated` says whether it was hit. */
  max_events?: number;
  count?: number;
  requested_user_ids?: string[];
  denied_user_ids?: string[];
  truncated?: boolean;
  events: CalendarEvent[];
  /** Set by the client (not the server) when the endpoint is unreachable. */
  unavailable?: boolean;
}

export interface CalendarMember {
  user_id: string;
  name: string;
  email?: string | null;
  /** Stable 0..11 palette index so a person is the same colour everywhere. */
  color_index: number;
  counts?: { meetings: number; tasks: number; follow_ups: number };
  is_self?: boolean;
}

export interface CalendarMembersResponse {
  can_view_team: boolean;
  self_user_id: string | null;
  members: CalendarMember[];
  /** Set by the client when the endpoint is unreachable. */
  unavailable?: boolean;
}

export interface AvailabilityRequest {
  user_ids: string[];
  start: string;
  end: string;
  duration_minutes?: number;
  granularity_minutes?: number;
  tz?: string;
  respect_working_hours?: boolean;
}

export interface AvailabilityBusyBlock {
  start: string;
  end: string;
  reason?: string;
}

export interface AvailabilitySlot {
  start: string;
  end: string;
  available_user_ids: string[];
}

export interface AvailabilityResponse {
  busy: Record<string, AvailabilityBusyBlock[]>;
  suggested_slots: AvailabilitySlot[];
  denied_user_ids?: string[];
  unavailable?: boolean;
}

export interface ConflictRequest {
  start_at: string;
  end_at: string;
  user_ids?: string[];
  exclude_meeting_id?: number | null;
  recurrence_rule?: string | null;
}

export interface CalendarConflict {
  user_id: string;
  user_name?: string | null;
  occurrence_start?: string | null;
  meeting_id: number;
  title: string;
  start_at: string;
  end_at: string;
  redacted?: boolean;
}

export interface ConflictResponse {
  has_conflicts: boolean;
  conflicts: CalendarConflict[];
  unavailable?: boolean;
}

/**
 * The caller's calendar preferences.
 *
 * `timezone` is seeded locally from `Intl.DateTimeFormat().resolvedOptions()
 * .timeZone` so the grid renders correctly even before the backend endpoint
 * exists; once `GET /api/calendar/preferences/` answers, the server value wins.
 */
export interface CalendarPreference {
  id?: number;
  timezone: string;
  /** Backend accepts only 0 (Sunday) or 1 (Monday). */
  week_starts_on?: 0 | 1;
  /** Django TimeField: serialised `HH:MM:SS`, accepted as `HH:MM` on write. */
  working_hours_start?: string;
  working_hours_end?: string;
  /** Ints 0-6, **0 = Sunday** (matches JS `Date.getDay()`). Default [1..5]. */
  working_days?: number[];
  /** Uppercase on the wire: MONTH | WEEK | DAY | AGENDA. */
  default_view?: 'MONTH' | 'WEEK' | 'DAY' | 'AGENDA';
  default_meeting_duration_minutes?: number;
  visible_layers?: CalendarLayer[];
  visible_user_ids?: string[];
  /** Seeds the `include_declined` default on /events/. */
  show_declined?: boolean;
  created_at?: string;
  updated_at?: string;
}

/*
 * NOTE: there is deliberately no `time_format` here. The backend
 * CalendarPreference has no such field, so 12h/24h is a purely client-side
 * preference held in `calendarStore`.
 */

export interface CalendarLayerMeta {
  key: CalendarLayer;
  label: string;
  /** The CRM permission that gates this layer, e.g. `crm.tasks.view`. */
  permission?: string;
  color_key: CalendarColorKey;
  default_on?: boolean;
  scope?: 'all' | 'team' | 'own' | null;
  /** `scope !== null` — whether the caller may see this layer at all. */
  visible?: boolean;
}

export interface CalendarLayersResponse {
  layers: CalendarLayerMeta[];
  /** color_key -> colour-name token map. */
  color_tokens?: Record<string, string>;
  max_range_days?: number;
  max_events?: number;
  unavailable?: boolean;
}

/** Extra params carried by every mutation on a recurring meeting (§B.3). */
export interface RecurrenceEditOptions {
  editScope?: RecurrenceEditScope;
  /** UTC start of the clicked occurrence. Required unless scope is `all`. */
  occurrenceStart?: string | null;
}

/** A not-yet-persisted event being composed by click-to-create / drag-create. */
export interface CalendarDraftEvent {
  start_at: string;
  end_at: string;
  all_day: boolean;
  title?: string;
  owner_user_id?: string | null;
  lead?: number | null;
}
