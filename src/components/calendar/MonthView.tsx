// src/components/calendar/MonthView.tsx
import { useMemo } from 'react';
import { addDays, startOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';
import { layoutSpanningBars } from '@/utils/calendarLayout';
import {
  buildMonthMatrix,
  dayKeyOfZoned,
  formatInZone,
  fromZoned,
  getEventDayKeys,
  toZoned,
  type WeekStartsOn,
} from '@/utils/calendarTime';
import type { CalendarEvent } from '@/types/calendar.types';
import { DayCell } from './DayCell';
import { EventChip } from './EventChip';

interface MonthViewProps {
  anchorDate: Date;
  events: CalendarEvent[];
  timezone: string;
  timeFormat?: '12h' | '24h';
  weekStartsOn?: WeekStartsOn;
  colorMode?: 'type' | 'person';
  colorIndexByUser?: Record<string, number>;
  onOpenEvent?: (event: CalendarEvent) => void;
  onCreateOnDay?: (zonedDay: Date) => void;
}

const BAR_HEIGHT = 20;

/**
 * The 6×7 month grid.
 *
 * Multi-day and all-day events render as bars that span across the week row
 * (`layoutSpanningBars`); everything else renders as a chip inside its day
 * cell. Each cell reserves vertical space for the bars above it so the chip
 * stacks never collide with a bar.
 *
 * This is a scaled-up version of the house pattern already proven by the
 * Dashboard's hand-rolled month grid — the Dashboard's own rendering is left
 * untouched.
 */
export function MonthView({
  anchorDate,
  events,
  timezone,
  timeFormat = '12h',
  weekStartsOn = 0,
  colorMode = 'type',
  colorIndexByUser,
  onOpenEvent,
  onCreateOnDay,
}: MonthViewProps) {
  const zonedAnchor = useMemo(() => toZoned(anchorDate, timezone), [anchorDate, timezone]);
  const weeks = useMemo(
    () => buildMonthMatrix(zonedAnchor, weekStartsOn),
    [zonedAnchor, weekStartsOn]
  );

  const weekdayLabels = useMemo(() => {
    const base = startOfWeek(zonedAnchor, { weekStartsOn });
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(base, i);
      return formatInZone(fromZoned(day, timezone), timezone, 'EEEEEE');
    });
  }, [zonedAnchor, weekStartsOn, timezone]);

  /** Split once: bars are laid out per week row, chips per day cell. */
  const { spanning, timedByDay } = useMemo(() => {
    const spanningEvents: CalendarEvent[] = [];
    const byDay: Record<string, CalendarEvent[]> = {};
    for (const event of events) {
      const keys = getEventDayKeys(event, timezone);
      if (event.all_day || keys.length > 1) {
        spanningEvents.push(event);
      } else if (keys.length === 1) {
        (byDay[keys[0]] ||= []).push(event);
      }
    }
    return { spanning: spanningEvents, timedByDay: byDay };
  }, [events, timezone]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Weekday header */}
      <div className="grid flex-shrink-0 grid-cols-7 border-b border-border/60">
        {weekdayLabels.map((label, i) => (
          <div
            key={i}
            className="px-2 py-1.5 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      <div
        className="grid min-h-0 flex-1 gap-px bg-border/60"
        style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}
      >
        {weeks.map((week, weekIndex) => {
          const { bars } = layoutSpanningBars(spanning, week, timezone, 3);
          const laneCount = bars.length ? Math.max(...bars.map((b) => b.lane)) + 1 : 0;

          return (
            <div key={weekIndex} className="relative grid min-h-0 grid-cols-7 gap-px">
              {week.map((zonedDay) => (
                <DayCell
                  key={dayKeyOfZoned(zonedDay)}
                  zonedDay={zonedDay}
                  monthAnchor={zonedAnchor}
                  events={timedByDay[dayKeyOfZoned(zonedDay)] ?? []}
                  reservedLanes={laneCount}
                  timezone={timezone}
                  timeFormat={timeFormat}
                  colorMode={colorMode}
                  colorIndexByUser={colorIndexByUser}
                  onOpenEvent={onOpenEvent}
                  onCreate={onCreateOnDay}
                />
              ))}

              {/* Spanning bars float above the cells of this week row. */}
              <div className="pointer-events-none absolute inset-x-0" style={{ top: 24 }}>
                {bars.map((bar) => (
                  <div
                    key={bar.event.id}
                    className={cn('pointer-events-auto absolute px-[3px]')}
                    style={{
                      top: bar.lane * BAR_HEIGHT,
                      left: `${(bar.startIndex / 7) * 100}%`,
                      width: `${(bar.span / 7) * 100}%`,
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
          );
        })}
      </div>
    </div>
  );
}

export default MonthView;
