// src/components/calendar/AllDayRow.tsx
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { layoutSpanningBars } from '@/utils/calendarLayout';
import type { CalendarEvent } from '@/types/calendar.types';
import { EventChip } from './EventChip';

interface AllDayRowProps {
  /** The zoned dates of the lane columns, in display order. */
  days: Date[];
  events: CalendarEvent[];
  timezone: string;
  timeFormat?: '12h' | '24h';
  colorMode?: 'type' | 'person';
  colorIndexByUser?: Record<string, number>;
  onOpenEvent?: (event: CalendarEvent) => void;
  /** Gutter width so the lane lines up with the time grid's hour column. */
  gutterWidth?: number;
}

const LANE_HEIGHT = 22;

/**
 * The banner lane above the time grid.
 *
 * All-day events are a DISTINCT rendering mode, not a 00:00→23:59 timed event:
 * they never appear in the hour columns, they span whole days as bars, and
 * their day bucketing is resolved in the EVENT's timezone (floating dates), not
 * the viewer's — see `getEventDayKeys` in `@/utils/calendarTime`.
 */
export function AllDayRow({
  days,
  events,
  timezone,
  timeFormat = '12h',
  colorMode = 'type',
  colorIndexByUser,
  onOpenEvent,
  gutterWidth = 56,
}: AllDayRowProps) {
  const { bars } = useMemo(
    () => layoutSpanningBars(events, days, timezone, 3),
    [events, days, timezone]
  );

  const laneCount = bars.length ? Math.max(...bars.map((b) => b.lane)) + 1 : 0;

  return (
    <div className="flex flex-shrink-0 border-b border-border/60 bg-background">
      <div
        className="flex flex-shrink-0 items-start justify-end pr-2 pt-1"
        style={{ width: gutterWidth }}
      >
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          All day
        </span>
      </div>

      <div className="relative min-w-0 flex-1">
        {/* Column separators so the lane reads as part of the same grid. */}
        <div className="absolute inset-0 flex">
          {days.map((day, index) => (
            <div
              key={index}
              className={cn('flex-1 border-l border-border/60', index === 0 && 'border-l')}
            />
          ))}
        </div>

        <div
          className="relative"
          style={{ height: Math.max(LANE_HEIGHT, laneCount * LANE_HEIGHT + 4) }}
        >
          {bars.map((bar) => (
            <div
              key={bar.event.id}
              className="absolute px-[2px]"
              style={{
                top: bar.lane * LANE_HEIGHT + 2,
                left: `${(bar.startIndex / days.length) * 100}%`,
                width: `${(bar.span / days.length) * 100}%`,
              }}
            >
              <EventChip
                event={bar.event}
                timezone={timezone}
                timeFormat={timeFormat}
                colorMode={colorMode}
                colorIndexByUser={colorIndexByUser}
                variant="allday"
                continuesBefore={bar.continuesBefore}
                continuesAfter={bar.continuesAfter}
                onOpen={onOpenEvent}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AllDayRow;
