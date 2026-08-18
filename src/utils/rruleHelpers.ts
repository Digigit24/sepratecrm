/**
 * RFC 5545 RRULE helpers, thin wrappers over `rrule`.
 *
 * Every function here is total: a malformed rule string coming back from the
 * API must never throw inside a render. Parsing failures degrade to `null` /
 * the raw string.
 */

import { RRule, Weekday } from 'rrule';

export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type RecurrenceEndMode = 'never' | 'count' | 'until';

export interface RecurrenceState {
  enabled: boolean;
  freq: RecurrenceFrequency;
  interval: number;
  /** 0=Mon … 6=Sun, matching `rrule`'s weekday ordering. */
  byweekday: number[];
  /** Day of month for MONTHLY rules. */
  bymonthday?: number | null;
  endMode: RecurrenceEndMode;
  count?: number | null;
  /** `yyyy-MM-dd` in the event's timezone. */
  until?: string | null;
}

const FREQ_MAP: Record<RecurrenceFrequency, number> = {
  DAILY: RRule.DAILY,
  WEEKLY: RRule.WEEKLY,
  MONTHLY: RRule.MONTHLY,
  YEARLY: RRule.YEARLY,
};

const FREQ_REVERSE: Record<number, RecurrenceFrequency> = {
  [RRule.DAILY]: 'DAILY',
  [RRule.WEEKLY]: 'WEEKLY',
  [RRule.MONTHLY]: 'MONTHLY',
  [RRule.YEARLY]: 'YEARLY',
};

/** `rrule` weekday order: MO=0 … SU=6. */
export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAY_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const defaultRecurrenceState = (start?: Date | null): RecurrenceState => ({
  enabled: false,
  freq: 'WEEKLY',
  interval: 1,
  // JS getDay(): 0=Sun … 6=Sat. rrule: 0=Mon … 6=Sun.
  byweekday: start ? [(start.getDay() + 6) % 7] : [],
  bymonthday: null,
  endMode: 'never',
  count: 10,
  until: null,
});

/**
 * Build an RRULE string (no `DTSTART`; the backend owns that via `start_at`).
 * Returns `null` when recurrence is disabled.
 */
export const buildRRule = (state: RecurrenceState): string | null => {
  if (!state.enabled) return null;
  try {
    const options: Record<string, unknown> = {
      freq: FREQ_MAP[state.freq],
      interval: Math.max(1, Math.round(state.interval || 1)),
    };
    if (state.freq === 'WEEKLY' && state.byweekday.length) {
      options.byweekday = state.byweekday.map((d) => new Weekday(d));
    }
    if (state.freq === 'MONTHLY' && state.bymonthday) {
      options.bymonthday = [state.bymonthday];
    }
    if (state.endMode === 'count' && state.count) {
      options.count = Math.max(1, Math.round(state.count));
    }
    if (state.endMode === 'until' && state.until) {
      const untilDate = new Date(`${state.until}T23:59:59Z`);
      if (!Number.isNaN(untilDate.getTime())) options.until = untilDate;
    }
    const rule = new RRule(options as ConstructorParameters<typeof RRule>[0]);
    // `toString()` emits "RRULE:FREQ=..."; the API stores the bare rule text.
    return rule.toString().replace(/^RRULE:/, '');
  } catch {
    return null;
  }
};

/** Parse an RRULE string back into editor state. Returns `null` on garbage. */
export const parseRRule = (
  rule: string | null | undefined
): RecurrenceState | null => {
  if (!rule) return null;
  try {
    const parsed = RRule.fromString(
      rule.startsWith('RRULE:') || rule.startsWith('DTSTART') ? rule : `RRULE:${rule}`
    );
    const o = parsed.origOptions;
    const freq = FREQ_REVERSE[(o.freq as number) ?? RRule.WEEKLY] ?? 'WEEKLY';

    const rawWeekdays = o.byweekday;
    const weekdays: number[] = Array.isArray(rawWeekdays)
      ? rawWeekdays.map((w) => (typeof w === 'number' ? w : (w as Weekday).weekday))
      : rawWeekdays
        ? [typeof rawWeekdays === 'number' ? rawWeekdays : (rawWeekdays as Weekday).weekday]
        : [];

    const rawMonthday = o.bymonthday;
    const monthday = Array.isArray(rawMonthday) ? rawMonthday[0] : rawMonthday;

    let endMode: RecurrenceEndMode = 'never';
    if (o.count) endMode = 'count';
    else if (o.until) endMode = 'until';

    return {
      enabled: true,
      freq,
      interval: (o.interval as number) || 1,
      byweekday: weekdays,
      bymonthday: typeof monthday === 'number' ? monthday : null,
      endMode,
      count: (o.count as number) ?? null,
      until: o.until ? new Date(o.until).toISOString().slice(0, 10) : null,
    };
  } catch {
    return null;
  }
};

/** "every week on Tuesday". Falls back to the raw string when unparseable. */
export const humanizeRRule = (rule: string | null | undefined): string => {
  if (!rule) return '';
  try {
    const parsed = RRule.fromString(rule.startsWith('RRULE:') ? rule : `RRULE:${rule}`);
    const text = parsed.toText();
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : rule;
  } catch {
    return rule;
  }
};

/**
 * The next `n` occurrence instants of a rule starting at `dtstart`.
 * Used for the live preview while the user is still typing the rule.
 */
export const previewOccurrences = (
  rule: string | null | undefined,
  dtstart: Date | null | undefined,
  n = 5
): Date[] => {
  if (!rule || !dtstart || Number.isNaN(dtstart.getTime())) return [];
  try {
    const parsed = RRule.fromString(rule.startsWith('RRULE:') ? rule : `RRULE:${rule}`);
    const withStart = new RRule({ ...parsed.origOptions, dtstart });
    return withStart.all((_, i) => i < n);
  } catch {
    return [];
  }
};

/** `true` when the event participates in a series and needs the scope dialog. */
export const isRecurringEvent = (event: {
  is_recurring?: boolean;
  series_id?: number | null;
  source: string;
}): boolean => event.source === 'meeting' && (!!event.is_recurring || !!event.series_id);
