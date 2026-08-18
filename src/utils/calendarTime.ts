/**
 * Calendar time helpers — the single place the calendar is allowed to convert
 * between a UTC instant and a wall-clock position on the grid.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The legacy backend `meetings/calendar/` action buckets events by their **UTC**
 * date, so a 02:00 IST meeting was filed under the previous day. Every date the
 * calendar renders therefore goes through `toZoned()` first: a UTC instant is
 * projected into the viewer's IANA zone and only *then* handed to plain
 * `date-fns`. Formatting a raw UTC string with plain `date-fns` is a bug.
 *
 * THE "ZONED DATE" CONVENTION
 * ---------------------------
 * `toZoned(instant, tz)` returns a JS `Date` whose *local* getters
 * (`getHours()`, `getDate()`, …) read out the wall clock **in `tz`**. Its epoch
 * value is deliberately shifted and is meaningless on its own. Such values are
 * called "zoned dates" throughout the calendar code. All grid maths
 * (`startOfWeek`, `differenceInMinutes`, `addDays`, …) happens on zoned dates;
 * `fromZoned()` converts a zoned date back to a real UTC instant before it is
 * ever sent to the API.
 *
 * ALL-DAY EVENTS
 * --------------
 * An all-day event is NOT a 00:00→23:59 timed event. It is a *floating* date
 * range: "9 September" means the 9th for everybody, regardless of where they
 * are sitting. Its day keys are therefore resolved in the **event's own**
 * timezone (`event.timezone`), not the viewer's, exactly like Google Calendar.
 * Timed events are bucketed in the **viewer's** timezone. `getEventDayKeys()`
 * is the one function that encodes this split.
 */

import {
  addDays,
  addMinutes,
  differenceInCalendarDays,
  differenceInMinutes,
  endOfMonth,
  endOfWeek,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';

export const MINUTES_PER_SLOT = 15;
export const DEFAULT_PX_PER_HOUR = 48;
export const DAY_KEY_FORMAT = 'yyyy-MM-dd';

export type WeekStartsOn = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** The browser's IANA zone, used to seed `CalendarPreference.timezone`. */
export const getBrowserTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

/** `true` when the string names a zone this runtime can actually resolve. */
export const isValidTimeZone = (tz: string | null | undefined): boolean => {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

/** Never throw on a bad/missing zone — fall back to the browser's. */
export const safeTimeZone = (tz: string | null | undefined): string =>
  isValidTimeZone(tz) ? (tz as string) : getBrowserTimeZone();

/** Parse an API instant. Returns `null` rather than an Invalid Date. */
export const parseInstant = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** UTC instant → zoned date (see the convention note at the top of this file). */
export const toZoned = (value: string | Date, tz: string): Date =>
  toZonedTime(value instanceof Date ? value : new Date(value), safeTimeZone(tz));

/** Zoned date → real UTC instant. */
export const fromZoned = (zoned: Date, tz: string): Date =>
  fromZonedTime(zoned, safeTimeZone(tz));

/** Zoned date → UTC ISO-8601 string, ready for the API. */
export const zonedToIso = (zoned: Date, tz: string): string =>
  fromZoned(zoned, tz).toISOString();

/** Format a UTC instant directly in `tz` (no intermediate local Date). */
export const formatInZone = (
  value: string | Date | null | undefined,
  tz: string,
  pattern: string
): string => {
  const d = parseInstant(value);
  if (!d) return '';
  try {
    return formatInTimeZone(d, safeTimeZone(tz), pattern);
  } catch {
    return '';
  }
};

/**
 * The `yyyy-MM-dd` bucket a UTC instant falls in, **in `tz`**.
 * This is the fix for the UTC-bucketing bug described at the top of the file.
 */
export const dayKeyInZone = (value: string | Date | null | undefined, tz: string): string =>
  formatInZone(value, tz, DAY_KEY_FORMAT);

/** The `yyyy-MM-dd` key of a zoned date, without re-converting zones. */
export const dayKeyOfZoned = (zoned: Date): string => {
  const y = zoned.getFullYear();
  const m = String(zoned.getMonth() + 1).padStart(2, '0');
  const d = String(zoned.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Short UTC offset label for the timezone badge, e.g. `GMT+5:30`. */
export const timeZoneLabel = (tz: string, at: Date = new Date()): string => {
  try {
    return formatInTimeZone(at, safeTimeZone(tz), 'OOO');
  } catch {
    return safeTimeZone(tz);
  }
};

/* ------------------------------------------------------------------ *
 * Grid geometry                                                       *
 * ------------------------------------------------------------------ */

/** Minutes since local midnight of a zoned date. */
export const minutesFromMidnight = (zoned: Date): number =>
  zoned.getHours() * 60 + zoned.getMinutes() + zoned.getSeconds() / 60;

export const minutesToPx = (minutes: number, pxPerHour = DEFAULT_PX_PER_HOUR): number =>
  (minutes / 60) * pxPerHour;

export const pxToMinutes = (px: number, pxPerHour = DEFAULT_PX_PER_HOUR): number =>
  (px / pxPerHour) * 60;

/** Round to the nearest N-minute slot (15 by default). */
export const snapToSlot = (minutes: number, slot = MINUTES_PER_SLOT): number =>
  Math.round(minutes / slot) * slot;

/** Snap a *pixel* offset to a slot boundary and return the minute value. */
export const pxToSnappedMinutes = (
  px: number,
  pxPerHour = DEFAULT_PX_PER_HOUR,
  slot = MINUTES_PER_SLOT
): number => snapToSlot(pxToMinutes(px, pxPerHour), slot);

/** Pixel height of one 15-minute slot — feeds `createSnapModifier`. */
export const slotHeightPx = (pxPerHour = DEFAULT_PX_PER_HOUR, slot = MINUTES_PER_SLOT): number =>
  (slot / 60) * pxPerHour;

/* ------------------------------------------------------------------ *
 * Range builders (all operate on zoned dates)                         *
 * ------------------------------------------------------------------ */

/** The 6×7 month matrix, as zoned dates. */
export const buildMonthMatrix = (
  anchorZoned: Date,
  weekStartsOn: WeekStartsOn = 0
): Date[][] => {
  const gridStart = startOfWeek(startOfMonth(anchorZoned), { weekStartsOn });
  const gridEnd = endOfWeek(endOfMonth(anchorZoned), { weekStartsOn });
  const weeks: Date[][] = [];
  let cursor = gridStart;
  // Always emit whole weeks; most months need 5, some need 6.
  while (cursor <= gridEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i += 1) {
      week.push(addDays(cursor, i));
    }
    weeks.push(week);
    cursor = addDays(cursor, 7);
  }
  return weeks;
};

/** The 7 zoned dates of the week containing `anchorZoned`. */
export const buildWeekDays = (
  anchorZoned: Date,
  weekStartsOn: WeekStartsOn = 0
): Date[] => {
  const start = startOfWeek(anchorZoned, { weekStartsOn });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

/**
 * The UTC window to request from `GET /api/calendar/events/` for a given view.
 * Computed from zoned day boundaries so the window matches what the grid draws.
 */
export const buildRangeForView = (
  view: 'month' | 'week' | 'day' | 'agenda',
  anchor: Date,
  tz: string,
  weekStartsOn: WeekStartsOn = 0,
  agendaDays = 30
): { start: string; end: string } => {
  const zonedAnchor = toZoned(anchor, tz);
  let startZoned: Date;
  let endZoned: Date;

  switch (view) {
    case 'month': {
      const matrix = buildMonthMatrix(zonedAnchor, weekStartsOn);
      startZoned = startOfDay(matrix[0][0]);
      endZoned = addDays(startOfDay(matrix[matrix.length - 1][6]), 1);
      break;
    }
    case 'week': {
      const days = buildWeekDays(zonedAnchor, weekStartsOn);
      startZoned = startOfDay(days[0]);
      endZoned = addDays(startOfDay(days[6]), 1);
      break;
    }
    case 'day': {
      startZoned = startOfDay(zonedAnchor);
      endZoned = addDays(startZoned, 1);
      break;
    }
    case 'agenda':
    default: {
      startZoned = startOfDay(zonedAnchor);
      endZoned = addDays(startZoned, agendaDays);
      break;
    }
  }

  return {
    start: zonedToIso(startZoned, tz),
    end: zonedToIso(endZoned, tz),
  };
};

/* ------------------------------------------------------------------ *
 * Working hours                                                       *
 * ------------------------------------------------------------------ */

/** Parse `'09:00'` → minutes from midnight. Returns `fallback` when invalid. */
export const parseClock = (value: string | undefined | null, fallback: number): number => {
  if (!value) return fallback;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return fallback;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return fallback;
  return hours * 60 + minutes;
};

export const isWorkingHour = (
  zoned: Date,
  opts: {
    workingHoursStart?: string | null;
    workingHoursEnd?: string | null;
    workingDays?: number[] | null;
  } = {}
): boolean => {
  const days = opts.workingDays && opts.workingDays.length ? opts.workingDays : [1, 2, 3, 4, 5];
  if (!days.includes(zoned.getDay())) return false;
  const start = parseClock(opts.workingHoursStart, 9 * 60);
  const end = parseClock(opts.workingHoursEnd, 18 * 60);
  const minutes = minutesFromMidnight(zoned);
  return minutes >= start && minutes < end;
};

/* ------------------------------------------------------------------ *
 * Event ↔ day bucketing                                               *
 * ------------------------------------------------------------------ */

interface DayKeyable {
  start_at: string;
  end_at: string;
  all_day: boolean;
  timezone?: string | null;
}

/**
 * Every `yyyy-MM-dd` bucket an event occupies.
 *
 * - **All-day** events resolve in the *event's* zone (floating dates) and treat
 *   `end_at` as **exclusive**, so `09-09T00:00Z → 09-10T00:00Z` is one day.
 * - **Timed** events resolve in the *viewer's* zone, which is what fixes the
 *   UTC-bucketing bug; an event that ends exactly at midnight does not bleed
 *   into the next day.
 */
export const getEventDayKeys = (event: DayKeyable, viewerTz: string): string[] => {
  const start = parseInstant(event.start_at);
  const end = parseInstant(event.end_at);
  if (!start) return [];

  const tz = event.all_day ? safeTimeZone(event.timezone || viewerTz) : safeTimeZone(viewerTz);
  const startZoned = toZoned(start, tz);

  let lastZoned: Date;
  if (!end || end.getTime() <= start.getTime()) {
    lastZoned = startZoned;
  } else if (event.all_day) {
    // Exclusive end: step back 1ms so a midnight end lands on the previous day.
    lastZoned = toZoned(new Date(end.getTime() - 1), tz);
  } else {
    const endZoned = toZoned(end, tz);
    // A timed event ending exactly at 00:00 belongs to the previous day only.
    lastZoned =
      minutesFromMidnight(endZoned) === 0 && !isSameDay(startZoned, endZoned)
        ? addDays(endZoned, -1)
        : endZoned;
  }

  const span = Math.max(0, differenceInCalendarDays(startOfDay(lastZoned), startOfDay(startZoned)));
  // Defensive cap: a corrupt end_at must not produce an unbounded loop.
  const days = Math.min(span, 366);
  return Array.from({ length: days + 1 }, (_, i) => dayKeyOfZoned(addDays(startZoned, i)));
};

/** `true` when the event overlaps the given zoned day at all. */
export const eventOccursOnDay = (
  event: DayKeyable,
  zonedDay: Date,
  viewerTz: string
): boolean => getEventDayKeys(event, viewerTz).includes(dayKeyOfZoned(zonedDay));

/** Index a feed by day key once, instead of filtering per cell. */
export const groupEventsByDay = <T extends DayKeyable>(
  events: T[],
  viewerTz: string
): Record<string, T[]> => {
  const map: Record<string, T[]> = {};
  for (const event of events) {
    for (const key of getEventDayKeys(event, viewerTz)) {
      (map[key] ||= []).push(event);
    }
  }
  return map;
};

/* ------------------------------------------------------------------ *
 * Display                                                             *
 * ------------------------------------------------------------------ */

export const timePattern = (timeFormat: '12h' | '24h' = '12h'): string =>
  timeFormat === '24h' ? 'HH:mm' : 'h:mm a';

/** `9:30 – 10:30 AM`, `All day`, or `Sep 9 – Sep 11` for multi-day. */
export const formatEventTimeRange = (
  event: DayKeyable & { title?: string },
  viewerTz: string,
  timeFormat: '12h' | '24h' = '12h'
): string => {
  const start = parseInstant(event.start_at);
  const end = parseInstant(event.end_at);
  if (!start) return '';

  if (event.all_day) {
    const keys = getEventDayKeys(event, viewerTz);
    const tz = safeTimeZone(event.timezone || viewerTz);
    if (keys.length <= 1) return 'All day';
    const last = end ? new Date(end.getTime() - 1) : start;
    return `${formatInZone(start, tz, 'MMM d')} – ${formatInZone(last, tz, 'MMM d')}`;
  }

  const pattern = timePattern(timeFormat);
  const startText = formatInZone(start, viewerTz, pattern);
  if (!end) return startText;
  const sameDay = dayKeyInZone(start, viewerTz) === dayKeyInZone(end, viewerTz);
  const endText = formatInZone(end, viewerTz, sameDay ? pattern : `MMM d, ${pattern}`);
  return `${startText} – ${endText}`;
};

/** Compact chip label, e.g. `9:30` / `9:30 AM`. */
export const formatEventStart = (
  event: DayKeyable,
  viewerTz: string,
  timeFormat: '12h' | '24h' = '12h'
): string => {
  if (event.all_day) return '';
  return formatInZone(event.start_at, viewerTz, timeFormat === '24h' ? 'HH:mm' : 'h:mma')
    .replace(':00', '')
    .toLowerCase();
};

/** Duration in whole minutes, floored at one slot so a chip is never 0px. */
export const eventDurationMinutes = (event: DayKeyable): number => {
  const start = parseInstant(event.start_at);
  const end = parseInstant(event.end_at);
  if (!start || !end) return MINUTES_PER_SLOT;
  return Math.max(MINUTES_PER_SLOT, differenceInMinutes(end, start));
};

/** Shift an instant by whole minutes, returning a UTC ISO string. */
export const shiftIso = (iso: string, minutes: number): string => {
  const d = parseInstant(iso);
  if (!d) return iso;
  return addMinutes(d, minutes).toISOString();
};

/**
 * Move an event to a new day while preserving its wall-clock time **in `tz`**.
 * Used by month-view drag, where only the date changes.
 */
export const moveToDayPreservingTime = (
  iso: string,
  targetZonedDay: Date,
  tz: string
): string => {
  const zoned = toZoned(iso, tz);
  const moved = new Date(targetZonedDay);
  moved.setHours(zoned.getHours(), zoned.getMinutes(), zoned.getSeconds(), 0);
  return zonedToIso(moved, tz);
};

/** Set the wall-clock minute-of-day of an instant, in `tz`. */
export const setMinutesOfDay = (
  zonedDay: Date,
  minutesOfDay: number,
  tz: string
): string => {
  const target = startOfDay(zonedDay);
  return zonedToIso(addMinutes(target, minutesOfDay), tz);
};
