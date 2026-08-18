/**
 * Calendar colour tokens.
 *
 * `UI_PRINCIPLES.md` requires every colour to come from an HSL CSS variable,
 * with ONE sanctioned exception: semantic status colours (`bg-emerald-500`,
 * `bg-amber-500`, …). Event-type colouring is that exception, and the amber /
 * indigo choices below deliberately match the existing Dashboard legend
 * (indigo = follow-ups, amber = tasks) so the two surfaces agree.
 *
 * Every class string here is written out in full: Tailwind's JIT scanner cannot
 * see dynamically concatenated class names.
 */

import type { CalendarColorKey, CalendarEvent } from '@/types/calendar.types';

export interface CalendarColorToken {
  /** Chip / block background + text. */
  chip: string;
  /** Solid accent bar or dot. */
  bar: string;
  /** Border used for the left accent stripe in team-overlay mode. */
  border: string;
  /** Human label for the legend. */
  label: string;
}

export const CALENDAR_COLORS: Record<CalendarColorKey, CalendarColorToken> = {
  meeting: {
    chip: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    bar: 'bg-blue-500',
    border: 'border-l-blue-500',
    label: 'Meeting',
  },
  demo: {
    chip: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
    bar: 'bg-violet-500',
    border: 'border-l-violet-500',
    label: 'Demo',
  },
  call: {
    chip: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
    bar: 'bg-cyan-500',
    border: 'border-l-cyan-500',
    label: 'Call',
  },
  site_visit: {
    chip: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
    bar: 'bg-teal-500',
    border: 'border-l-teal-500',
    label: 'Site visit',
  },
  internal: {
    chip: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
    bar: 'bg-slate-500',
    border: 'border-l-slate-500',
    label: 'Internal',
  },
  task: {
    chip: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    bar: 'bg-amber-500',
    border: 'border-l-amber-500',
    label: 'Task',
  },
  follow_up: {
    chip: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
    bar: 'bg-indigo-500',
    border: 'border-l-indigo-500',
    label: 'Follow-up',
  },
  activity: {
    chip: 'bg-stone-500/15 text-stone-700 dark:text-stone-300',
    bar: 'bg-stone-500',
    border: 'border-l-stone-500',
    label: 'Activity',
  },
  cancelled: {
    chip: 'bg-muted text-muted-foreground line-through',
    bar: 'bg-muted-foreground/40',
    border: 'border-l-muted-foreground/40',
    label: 'Cancelled',
  },
};

/** Legend order — mirrors the left rail and the Dashboard legend. */
export const LEGEND_KEYS: CalendarColorKey[] = [
  'meeting',
  'demo',
  'call',
  'site_visit',
  'task',
  'follow_up',
];

/**
 * Twelve person colours for team mode, indexed by `member.color_index` so the
 * same person is the same colour on every device (the index is a stable hash of
 * the user UUID computed server-side).
 */
export const MEMBER_COLORS: CalendarColorToken[] = [
  { chip: 'bg-rose-500/15 text-rose-700 dark:text-rose-300', bar: 'bg-rose-500', border: 'border-l-rose-500', label: 'Rose' },
  { chip: 'bg-orange-500/15 text-orange-700 dark:text-orange-300', bar: 'bg-orange-500', border: 'border-l-orange-500', label: 'Orange' },
  { chip: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', bar: 'bg-amber-500', border: 'border-l-amber-500', label: 'Amber' },
  { chip: 'bg-lime-500/15 text-lime-700 dark:text-lime-300', bar: 'bg-lime-500', border: 'border-l-lime-500', label: 'Lime' },
  { chip: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-500', border: 'border-l-emerald-500', label: 'Emerald' },
  { chip: 'bg-teal-500/15 text-teal-700 dark:text-teal-300', bar: 'bg-teal-500', border: 'border-l-teal-500', label: 'Teal' },
  { chip: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300', bar: 'bg-cyan-500', border: 'border-l-cyan-500', label: 'Cyan' },
  { chip: 'bg-sky-500/15 text-sky-700 dark:text-sky-300', bar: 'bg-sky-500', border: 'border-l-sky-500', label: 'Sky' },
  { chip: 'bg-blue-500/15 text-blue-700 dark:text-blue-300', bar: 'bg-blue-500', border: 'border-l-blue-500', label: 'Blue' },
  { chip: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300', bar: 'bg-indigo-500', border: 'border-l-indigo-500', label: 'Indigo' },
  { chip: 'bg-violet-500/15 text-violet-700 dark:text-violet-300', bar: 'bg-violet-500', border: 'border-l-violet-500', label: 'Violet' },
  { chip: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300', bar: 'bg-fuchsia-500', border: 'border-l-fuchsia-500', label: 'Fuchsia' },
];

export const memberColor = (colorIndex: number | null | undefined): CalendarColorToken =>
  MEMBER_COLORS[Math.abs(colorIndex ?? 0) % MEMBER_COLORS.length];

/** Deterministic fallback index when the server did not supply one. */
export const fallbackColorIndex = (userId: string | null | undefined): number => {
  if (!userId) return 0;
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % MEMBER_COLORS.length;
};

const MEETING_TYPE_TO_COLOR: Record<string, CalendarColorKey> = {
  MEETING: 'meeting',
  DEMO: 'demo',
  CALL: 'call',
  SITE_VISIT: 'site_visit',
  INTERNAL: 'internal',
  OTHER: 'meeting',
};

const SOURCE_TO_COLOR: Record<string, CalendarColorKey> = {
  meeting: 'meeting',
  task: 'task',
  follow_up: 'follow_up',
  activity: 'activity',
};

/** Resolve an event to a colour key, tolerating an unknown `color_key`. */
export const resolveColorKey = (event: CalendarEvent): CalendarColorKey => {
  if (event.status === 'CANCELLED') return 'cancelled';
  const raw = event.color_key;
  if (raw && raw in CALENDAR_COLORS) return raw as CalendarColorKey;
  if (event.source === 'meeting' && event.meeting_type) {
    const byType = MEETING_TYPE_TO_COLOR[String(event.meeting_type).toUpperCase()];
    if (byType) return byType;
  }
  return SOURCE_TO_COLOR[event.source] ?? 'meeting';
};

/**
 * Colour an event either by type (default) or by person (team modes).
 * In person mode the type is still signalled, via the left border stripe.
 */
export const getEventColor = (
  event: CalendarEvent,
  mode: 'type' | 'person' = 'type',
  colorIndexByUser?: Record<string, number>
): CalendarColorToken => {
  if (event.status === 'CANCELLED') return CALENDAR_COLORS.cancelled;
  if (mode === 'person') {
    const ownerId = event.owner_user_id || '';
    const index = colorIndexByUser?.[ownerId] ?? fallbackColorIndex(ownerId);
    return memberColor(index);
  }
  return CALENDAR_COLORS[resolveColorKey(event)];
};

/* ------------------------------------------------------------------ *
 * PRIVATE-event redaction — the client's own fail-closed guard         *
 * ------------------------------------------------------------------ */

/**
 * `true` when this event must be rendered as free/busy only.
 *
 * The server already redacts PRIVATE events it decides the viewer may not see
 * (§B.2 endpoint 13), but the UI does not rely on that alone: if
 * `visibility === 'PRIVATE'` and the viewer is neither the owner nor an
 * attendee, we redact locally too. A backend that is still being built must not
 * be able to leak a private title into the grid, a team lane, or a hover card.
 */
export const isRedacted = (
  event: CalendarEvent,
  viewerUserId?: string | null
): boolean => {
  if (event.redacted) return true;
  if (event.visibility !== 'PRIVATE') return false;
  if (!viewerUserId) return true; // fail closed when we cannot identify the viewer
  if (event.owner_user_id && String(event.owner_user_id) === String(viewerUserId)) return false;
  const isAttendee = (event.attendees || []).some(
    (a) => a.user_id && String(a.user_id) === String(viewerUserId)
  );
  return !isAttendee;
};

/** The label a redacted event is allowed to show. Never the real title. */
export const REDACTED_TITLE = 'Busy';

/**
 * Strip every leakable field from a redacted event. Call this ONCE, as close to
 * the data source as possible, so no downstream component can accidentally read
 * `event.title` on a private event.
 */
export const redactEvent = (event: CalendarEvent): CalendarEvent => ({
  id: event.id,
  source: event.source,
  source_id: event.source_id,
  start_at: event.start_at,
  end_at: event.end_at,
  all_day: event.all_day,
  timezone: event.timezone,
  owner_user_id: event.owner_user_id,
  owner_name: event.owner_name,
  transparency: event.transparency,
  visibility: 'PRIVATE',
  status: event.status,
  title: REDACTED_TITLE,
  redacted: true,
  can_edit: false,
  can_delete: false,
});

/** Apply redaction across a whole feed. */
export const redactFeed = (
  events: CalendarEvent[],
  viewerUserId?: string | null
): CalendarEvent[] =>
  events.map((e) => (isRedacted(e, viewerUserId) ? redactEvent(e) : e));
