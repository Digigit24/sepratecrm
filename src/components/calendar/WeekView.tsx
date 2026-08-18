// src/components/calendar/WeekView.tsx
import { useMemo } from 'react';
import {
  buildWeekDays,
  dayKeyOfZoned,
  formatInZone,
  fromZoned,
  getEventDayKeys,
  toZoned,
  type WeekStartsOn,
} from '@/utils/calendarTime';
import type { CalendarEvent } from '@/types/calendar.types';
import { AllDayRow } from './AllDayRow';
import { TimeGrid, type TimeGridLane } from './TimeGrid';

interface WeekViewProps {
  anchorDate: Date;
  events: CalendarEvent[];
  timezone: string;
  timeFormat?: '12h' | '24h';
  weekStartsOn?: WeekStartsOn;
  pxPerHour: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  workingDays: number[];
  colorMode?: 'type' | 'person';
  colorIndexByUser?: Record<string, number>;
  onOpenEvent?: (event: CalendarEvent) => void;
  onCreateAt?: (zonedDay: Date, minutesOfDay: number) => void;
}

/**
 * Seven day columns plus the all-day banner lane.
 *
 * All-day events are routed to `AllDayRow` and are deliberately absent from the
 * hour columns; `TimeGridColumn` filters them out again as a second guard.
 */
export function WeekView({
  anchorDate,
  events,
  timezone,
  timeFormat = '12h',
  weekStartsOn = 0,
  pxPerHour,
  workingHoursStart,
  workingHoursEnd,
  workingDays,
  colorMode = 'type',
  colorIndexByUser,
  onOpenEvent,
  onCreateAt,
}: WeekViewProps) {
  const days = useMemo(
    () => buildWeekDays(toZoned(anchorDate, timezone), weekStartsOn),
    [anchorDate, timezone, weekStartsOn]
  );

  const allDayEvents = useMemo(() => events.filter((e) => e.all_day), [events]);
  const timedEvents = useMemo(() => events.filter((e) => !e.all_day), [events]);

  const lanes: TimeGridLane[] = useMemo(
    () =>
      days.map((zonedDay) => {
        const key = dayKeyOfZoned(zonedDay);
        return {
          key,
          zonedDay,
          primaryLabel: formatInZone(fromZoned(zonedDay, timezone), timezone, 'EEE'),
          secondaryLabel: String(zonedDay.getDate()),
          events: timedEvents.filter((e) => getEventDayKeys(e, timezone).includes(key)),
        };
      }),
    [days, timedEvents, timezone]
  );

  return (
    <TimeGrid
      lanes={lanes}
      timezone={timezone}
      timeFormat={timeFormat}
      pxPerHour={pxPerHour}
      workingHoursStart={workingHoursStart}
      workingHoursEnd={workingHoursEnd}
      workingDays={workingDays}
      colorMode={colorMode}
      colorIndexByUser={colorIndexByUser}
      onOpenEvent={onOpenEvent}
      onCreateAt={(zonedDay, minutes) => onCreateAt?.(zonedDay, minutes)}
      headerExtra={
        <AllDayRow
          days={days}
          events={allDayEvents}
          timezone={timezone}
          timeFormat={timeFormat}
          colorMode={colorMode}
          colorIndexByUser={colorIndexByUser}
          onOpenEvent={onOpenEvent}
        />
      }
    />
  );
}

export default WeekView;
