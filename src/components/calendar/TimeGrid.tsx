// src/components/calendar/TimeGrid.tsx
import { useEffect, useMemo, useRef } from 'react';
import { isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  formatInZone,
  fromZoned,
  minutesToPx,
  parseClock,
  timePattern,
} from '@/utils/calendarTime';
import type { CalendarEvent } from '@/types/calendar.types';
import { TimeGridColumn } from './TimeGridColumn';

export interface TimeGridLane {
  /** Stable key: a day key, or a user id in team-lane mode. */
  key: string;
  /** Zoned date this lane renders. */
  zonedDay: Date;
  /** Two-line header: primary label + secondary label. */
  primaryLabel: string;
  secondaryLabel?: string;
  /** Swatch shown in team-lane mode. */
  swatchClassName?: string;
  ownerUserId?: string | null;
  events: CalendarEvent[];
}

interface TimeGridProps {
  lanes: TimeGridLane[];
  timezone: string;
  timeFormat?: '12h' | '24h';
  pxPerHour: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  workingDays: number[];
  colorMode?: 'type' | 'person';
  colorIndexByUser?: Record<string, number>;
  detailed?: boolean;
  onOpenEvent?: (event: CalendarEvent) => void;
  onCreateAt?: (zonedDay: Date, minutesOfDay: number, ownerUserId?: string | null) => void;
  /** Rendered between the header and the scrolling body (the all-day lane). */
  headerExtra?: React.ReactNode;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const GUTTER_WIDTH = 56;

/**
 * The shared engine behind Week, Day and Team-lanes.
 *
 * Only the body scrolls; the day/person header row is sticky, matching the
 * app-wide "only <main> scrolls" rule. On mount the body scrolls to the start
 * of working hours so the user lands on their day rather than on 00:00.
 */
export function TimeGrid({
  lanes,
  timezone,
  timeFormat = '12h',
  pxPerHour,
  workingHoursStart,
  workingHoursEnd,
  workingDays,
  colorMode = 'type',
  colorIndexByUser,
  detailed = false,
  onOpenEvent,
  onCreateAt,
  headerExtra,
}: TimeGridProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const didScroll = useRef(false);

  useEffect(() => {
    if (didScroll.current || !bodyRef.current) return;
    didScroll.current = true;
    const startMinutes = parseClock(workingHoursStart, 8 * 60);
    // Leave a little context above the first working hour.
    bodyRef.current.scrollTop = Math.max(0, minutesToPx(startMinutes - 30, pxPerHour));
  }, [workingHoursStart, pxPerHour]);

  const hourLabels = useMemo(
    () =>
      HOURS.map((hour) => {
        // Format a real instant so 12h/24h and locale rules are honoured.
        const sample = new Date(lanes[0]?.zonedDay ?? new Date());
        sample.setHours(hour, 0, 0, 0);
        return {
          hour,
          label: formatInZone(fromZoned(sample, timezone), timezone, timePattern(timeFormat)),
        };
      }),
    [lanes, timezone, timeFormat]
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Sticky lane header */}
      <div className="flex flex-shrink-0 border-b border-border/60 bg-background">
        <div className="flex-shrink-0" style={{ width: GUTTER_WIDTH }} />
        {lanes.map((lane) => (
          <div
            key={lane.key}
            className="min-w-0 flex-1 border-l border-border/60 px-2 py-1.5 text-center"
          >
            <div className="flex items-center justify-center gap-1.5">
              {lane.swatchClassName ? (
                <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', lane.swatchClassName)} />
              ) : null}
              <span className="truncate text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                {lane.primaryLabel}
              </span>
            </div>
            {lane.secondaryLabel ? (
              <div
                className={cn(
                  'mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-medium',
                  isToday(lane.zonedDay)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground'
                )}
              >
                {lane.secondaryLabel}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {headerExtra}

      {/* Scrolling body */}
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-auto">
        <div className="flex" style={{ height: pxPerHour * 24 }}>
          {/* Hour gutter */}
          <div
            className="relative flex-shrink-0 select-none bg-background"
            style={{ width: GUTTER_WIDTH }}
          >
            {hourLabels.map(({ hour, label }) => (
              <div
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
                style={{ top: minutesToPx(hour * 60, pxPerHour) }}
              >
                {hour === 0 ? '' : label}
              </div>
            ))}
          </div>

          {lanes.map((lane) => (
            <TimeGridColumn
              key={lane.key}
              zonedDay={lane.zonedDay}
              events={lane.events}
              timezone={timezone}
              timeFormat={timeFormat}
              pxPerHour={pxPerHour}
              workingHoursStart={workingHoursStart}
              workingHoursEnd={workingHoursEnd}
              workingDays={workingDays}
              colorMode={colorMode}
              colorIndexByUser={colorIndexByUser}
              detailed={detailed}
              ownerUserId={lane.ownerUserId}
              onOpenEvent={onOpenEvent}
              onCreateAt={(zonedDay, minutes) => onCreateAt?.(zonedDay, minutes, lane.ownerUserId)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default TimeGrid;
