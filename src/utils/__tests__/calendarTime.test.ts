import { describe, expect, it } from 'vitest';
import {
  buildRangeForView,
  dayKeyInZone,
  formatEventTimeRange,
  getEventDayKeys,
  groupEventsByDay,
  minutesFromMidnight,
  pxToSnappedMinutes,
  snapToSlot,
  toZoned,
} from '@/utils/calendarTime';

/**
 * The bug this file exists to prevent: the legacy backend bucketed events by
 * their UTC date, so an IST user's early-morning meeting appeared on the
 * previous day. Every assertion below is about a UTC instant landing on the
 * right LOCAL day.
 */
describe('local-timezone date bucketing', () => {
  const IST = 'Asia/Kolkata'; // UTC+5:30, no DST
  const NY = 'America/New_York'; // UTC-5 / -4

  it('files a 02:00 IST meeting on the IST day, not the UTC day', () => {
    // 2026-09-08T20:30:00Z === 2026-09-09 02:00 IST
    const instant = '2026-09-08T20:30:00Z';

    expect(dayKeyInZone(instant, 'UTC')).toBe('2026-09-08');
    expect(dayKeyInZone(instant, IST)).toBe('2026-09-09');
  });

  it('buckets a timed event by the viewer timezone', () => {
    const event = {
      start_at: '2026-09-08T20:30:00Z',
      end_at: '2026-09-08T21:30:00Z',
      all_day: false,
      timezone: 'UTC',
    };

    expect(getEventDayKeys(event, IST)).toEqual(['2026-09-09']);
    expect(getEventDayKeys(event, 'UTC')).toEqual(['2026-09-08']);
  });

  it('puts a meeting that crosses local midnight on both local days', () => {
    // 23:30 -> 00:30 in New York
    const event = {
      start_at: '2026-03-10T03:30:00Z',
      end_at: '2026-03-10T04:30:00Z',
      all_day: false,
      timezone: NY,
    };
    expect(getEventDayKeys(event, NY)).toEqual(['2026-03-09', '2026-03-10']);
  });

  it('does not bleed an event that ends exactly at local midnight into the next day', () => {
    const event = {
      start_at: '2026-09-08T17:00:00Z', // 22:30 IST
      end_at: '2026-09-08T18:30:00Z', // 00:00 IST next day
      all_day: false,
      timezone: IST,
    };
    expect(getEventDayKeys(event, IST)).toEqual(['2026-09-08']);
  });

  it('groups a feed into day buckets using the viewer zone', () => {
    const events = [
      { id: 'a', start_at: '2026-09-08T20:30:00Z', end_at: '2026-09-08T21:00:00Z', all_day: false },
      { id: 'b', start_at: '2026-09-08T10:00:00Z', end_at: '2026-09-08T11:00:00Z', all_day: false },
    ];
    const grouped = groupEventsByDay(events, IST);
    expect(Object.keys(grouped).sort()).toEqual(['2026-09-08', '2026-09-09']);
    expect(grouped['2026-09-09'].map((e) => e.id)).toEqual(['a']);
  });

  it('projects an instant into a zoned wall clock', () => {
    const zoned = toZoned('2026-09-08T20:30:00Z', IST);
    expect(zoned.getHours()).toBe(2);
    expect(zoned.getMinutes()).toBe(0);
    expect(minutesFromMidnight(zoned)).toBe(120);
  });

  it('builds a day range from local midnight, not UTC midnight', () => {
    const range = buildRangeForView('day', new Date('2026-09-09T06:00:00Z'), IST);
    // Local midnight in IST is 18:30Z the previous day.
    expect(range.start).toBe('2026-09-08T18:30:00.000Z');
    expect(range.end).toBe('2026-09-09T18:30:00.000Z');
  });
});

describe('all-day rendering', () => {
  const IST = 'Asia/Kolkata';
  const LA = 'America/Los_Angeles';

  it('treats the all-day end as exclusive, so one day stays one day', () => {
    const event = {
      start_at: '2026-09-09T00:00:00Z',
      end_at: '2026-09-10T00:00:00Z',
      all_day: true,
      timezone: 'UTC',
    };
    expect(getEventDayKeys(event, 'UTC')).toEqual(['2026-09-09']);
  });

  it('is a FLOATING date: the same day for every viewer', () => {
    // Authored in IST; the viewer sits in Los Angeles.
    const event = {
      start_at: '2026-09-08T18:30:00Z', // 2026-09-09 00:00 IST
      end_at: '2026-09-09T18:30:00Z', // 2026-09-10 00:00 IST
      all_day: true,
      timezone: IST,
    };
    expect(getEventDayKeys(event, LA)).toEqual(['2026-09-09']);
    expect(getEventDayKeys(event, IST)).toEqual(['2026-09-09']);
    expect(getEventDayKeys(event, 'UTC')).toEqual(['2026-09-09']);
  });

  it('spans multiple days for a multi-day all-day event', () => {
    const event = {
      start_at: '2026-09-09T00:00:00Z',
      end_at: '2026-09-12T00:00:00Z',
      all_day: true,
      timezone: 'UTC',
    };
    expect(getEventDayKeys(event, 'UTC')).toEqual([
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
    ]);
  });

  it('labels an all-day event "All day" instead of a 00:00–23:59 range', () => {
    const event = {
      start_at: '2026-09-09T00:00:00Z',
      end_at: '2026-09-10T00:00:00Z',
      all_day: true,
      timezone: 'UTC',
    };
    expect(formatEventTimeRange(event, 'UTC')).toBe('All day');
  });

  it('labels a multi-day all-day event as a date range', () => {
    const event = {
      start_at: '2026-09-09T00:00:00Z',
      end_at: '2026-09-12T00:00:00Z',
      all_day: true,
      timezone: 'UTC',
    };
    expect(formatEventTimeRange(event, 'UTC')).toBe('Sep 9 – Sep 11');
  });

  it('still renders a timed event as a time range', () => {
    const event = {
      start_at: '2026-09-08T04:00:00Z',
      end_at: '2026-09-08T05:00:00Z',
      all_day: false,
      timezone: 'Asia/Kolkata',
    };
    expect(formatEventTimeRange(event, 'Asia/Kolkata')).toBe('9:30 AM – 10:30 AM');
  });
});

describe('15-minute snapping', () => {
  it('rounds minutes to the nearest slot', () => {
    expect(snapToSlot(7)).toBe(0);
    expect(snapToSlot(8)).toBe(15);
    expect(snapToSlot(23)).toBe(30);
    expect(snapToSlot(-8)).toBe(-15);
  });

  it('converts a pixel offset into a snapped minute value', () => {
    // 48px per hour -> 12px per 15 minutes.
    expect(pxToSnappedMinutes(13, 48)).toBe(15);
    expect(pxToSnappedMinutes(48, 48)).toBe(60);
  });
});
