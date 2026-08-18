/**
 * Geometry for the calendar grids.
 *
 * Two independent problems live here:
 *
 * 1. **Time grid packing** — overlapping timed events in one day column must be
 *    laid out side by side. Classic sweep: sort by start, accumulate a cluster
 *    while anything in it still overlaps, then greedily assign each event to the
 *    first column whose last member has already ended.
 *
 * 2. **Month lane assignment** — a multi-day / all-day event renders as one bar
 *    spanning several cells of a week row, so each week row needs its bars
 *    stacked into lanes that never collide.
 */

import { addDays, startOfDay } from 'date-fns';
import type { CalendarEvent } from '@/types/calendar.types';
import {
  dayKeyOfZoned,
  eventDurationMinutes,
  getEventDayKeys,
  minutesFromMidnight,
  parseInstant,
  toZoned,
} from './calendarTime';

export interface PositionedEvent {
  event: CalendarEvent;
  /** Minutes from midnight (viewer tz) where the block starts. */
  startMinutes: number;
  /** Block height in minutes; never smaller than one slot. */
  durationMinutes: number;
  /** 0..1 fraction of the column width. */
  left: number;
  width: number;
  /** Stacking order for the slight overlap effect. */
  zIndex: number;
}

const MIN_BLOCK_MINUTES = 15;

/**
 * Clip an event to a single zoned day and express it in minutes-from-midnight.
 * Events that started yesterday are clamped to 0; events that run past midnight
 * are clamped to 1440 so a block never overflows its column.
 */
const clipToDay = (
  event: CalendarEvent,
  zonedDay: Date,
  tz: string
): { startMinutes: number; durationMinutes: number } | null => {
  const start = parseInstant(event.start_at);
  if (!start) return null;

  const dayStart = startOfDay(zonedDay);
  const dayEnd = addDays(dayStart, 1);

  const startZoned = toZoned(start, tz);
  const endInstant = parseInstant(event.end_at);
  const endZoned = endInstant ? toZoned(endInstant, tz) : startZoned;

  const clippedStart = startZoned < dayStart ? dayStart : startZoned;
  const clippedEnd = endZoned > dayEnd ? dayEnd : endZoned;
  if (clippedEnd <= clippedStart) {
    // Zero-length or fully outside — still render one slot at the start.
    const m = minutesFromMidnight(clippedStart);
    return { startMinutes: Math.min(m, 1440 - MIN_BLOCK_MINUTES), durationMinutes: MIN_BLOCK_MINUTES };
  }

  const startMinutes = minutesFromMidnight(clippedStart);
  const durationMinutes = Math.max(
    MIN_BLOCK_MINUTES,
    (clippedEnd.getTime() - clippedStart.getTime()) / 60000
  );
  return { startMinutes, durationMinutes };
};

/**
 * Pack the timed events of one day column.
 * `zonedDay` is a zoned date (see `calendarTime.ts`); `tz` is the viewer zone.
 */
export const layoutDayColumn = (
  events: CalendarEvent[],
  zonedDay: Date,
  tz: string
): PositionedEvent[] => {
  const dayKey = dayKeyOfZoned(zonedDay);

  const candidates = events
    .filter((e) => !e.all_day)
    .filter((e) => getEventDayKeys(e, tz).includes(dayKey))
    .map((event) => {
      const clipped = clipToDay(event, zonedDay, tz);
      return clipped ? { event, ...clipped } : null;
    })
    .filter((v): v is { event: CalendarEvent; startMinutes: number; durationMinutes: number } => !!v)
    .sort((a, b) => {
      if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
      // Longer events first so they end up in the leftmost column.
      return b.durationMinutes - a.durationMinutes;
    });

  const positioned: PositionedEvent[] = [];

  let cluster: typeof candidates = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (!cluster.length) return;
    // Greedy column assignment within the cluster.
    const columnEnds: number[] = [];
    const columnOf = new Map<string, number>();

    for (const item of cluster) {
      const end = item.startMinutes + item.durationMinutes;
      let col = columnEnds.findIndex((colEnd) => colEnd <= item.startMinutes);
      if (col === -1) {
        col = columnEnds.length;
        columnEnds.push(end);
      } else {
        columnEnds[col] = end;
      }
      columnOf.set(item.event.id, col);
    }

    const columnCount = Math.max(1, columnEnds.length);
    for (const item of cluster) {
      const col = columnOf.get(item.event.id) ?? 0;
      positioned.push({
        event: item.event,
        startMinutes: item.startMinutes,
        durationMinutes: item.durationMinutes,
        left: col / columnCount,
        // Slight overlap reads better than hairline gaps (Notion/Google do this).
        width: columnCount === 1 ? 1 : (1 / columnCount) * 1.1,
        zIndex: 10 + col,
      });
    }
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const item of candidates) {
    if (cluster.length && item.startMinutes >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.startMinutes + item.durationMinutes);
  }
  flush();

  return positioned;
};

/* ------------------------------------------------------------------ *
 * Month / all-day lane assignment                                     *
 * ------------------------------------------------------------------ */

export interface SpanningBar {
  event: CalendarEvent;
  /** 0-based column index within the week row where the bar starts. */
  startIndex: number;
  /** Number of columns the bar covers (>= 1). */
  span: number;
  /** Lane (row) within the cell stack. */
  lane: number;
  /** The bar is clipped at the start / end of this week row. */
  continuesBefore: boolean;
  continuesAfter: boolean;
}

/**
 * Assign lanes to the spanning (all-day / multi-day) events of one week row.
 * `weekDays` are the 7 zoned dates of the row, in display order.
 */
export const layoutSpanningBars = (
  events: CalendarEvent[],
  weekDays: Date[],
  tz: string,
  maxLanes = 4
): { bars: SpanningBar[]; overflowByDay: Record<string, number> } => {
  const dayKeys = weekDays.map(dayKeyOfZoned);
  const indexOfKey = new Map(dayKeys.map((k, i) => [k, i] as const));

  const candidates = events
    .map((event) => {
      const keys = getEventDayKeys(event, tz);
      if (!keys.length) return null;
      // Only events that span >1 day, or are all-day, get a bar.
      if (!event.all_day && keys.length < 2) return null;
      const inRow = keys.filter((k) => indexOfKey.has(k));
      if (!inRow.length) return null;
      const indices = inRow.map((k) => indexOfKey.get(k) as number).sort((a, b) => a - b);
      const startIndex = indices[0];
      const endIndex = indices[indices.length - 1];
      return {
        event,
        startIndex,
        span: endIndex - startIndex + 1,
        continuesBefore: indexOfKey.get(keys[0]) === undefined,
        continuesAfter: indexOfKey.get(keys[keys.length - 1]) === undefined,
      };
    })
    .filter((v): v is NonNullable<typeof v> => !!v)
    .sort((a, b) => {
      if (a.startIndex !== b.startIndex) return a.startIndex - b.startIndex;
      if (a.span !== b.span) return b.span - a.span;
      return a.event.id.localeCompare(b.event.id);
    });

  const lanes: number[][] = []; // lanes[lane][dayIndex] = occupied flag (1/0)
  const bars: SpanningBar[] = [];
  const overflowByDay: Record<string, number> = {};

  for (const candidate of candidates) {
    let lane = 0;
    for (; lane < lanes.length; lane += 1) {
      const row = lanes[lane];
      let free = true;
      for (let i = candidate.startIndex; i < candidate.startIndex + candidate.span; i += 1) {
        if (row[i]) {
          free = false;
          break;
        }
      }
      if (free) break;
    }
    if (lane >= maxLanes) {
      for (let i = candidate.startIndex; i < candidate.startIndex + candidate.span; i += 1) {
        const key = dayKeys[i];
        if (key) overflowByDay[key] = (overflowByDay[key] || 0) + 1;
      }
      continue;
    }
    if (lane >= lanes.length) lanes.push(new Array(7).fill(0));
    for (let i = candidate.startIndex; i < candidate.startIndex + candidate.span; i += 1) {
      lanes[lane][i] = 1;
    }
    bars.push({ ...candidate, lane });
  }

  return { bars, overflowByDay };
};

/** Chronological sort used by month cells, the agenda list and day popovers. */
export const sortEventsForDisplay = (events: CalendarEvent[]): CalendarEvent[] =>
  [...events].sort((a, b) => {
    if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
    const at = parseInstant(a.start_at)?.getTime() ?? 0;
    const bt = parseInstant(b.start_at)?.getTime() ?? 0;
    if (at !== bt) return at - bt;
    return eventDurationMinutes(b) - eventDurationMinutes(a);
  });
