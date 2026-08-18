// src/components/calendar/DayView.tsx
import { useMemo } from 'react';
import { startOfDay } from 'date-fns';
import {
  dayKeyOfZoned,
  formatInZone,
  fromZoned,
  getEventDayKeys,
  toZoned,
} from '@/utils/calendarTime';
import type { CalendarEvent } from '@/types/calendar.types';
import { AllDayRow } from './AllDayRow';
import { TimeGrid, type TimeGridLane } from './TimeGrid';

interface DayViewProps {
  anchorDate: Date;
  events: CalendarEvent[];
  timezone: string;
  timeFormat?: '12h' | '24h';
  pxPerHour: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  workingDays: number[];
  colorMode?: 'type' | 'person';
  colorIndexByUser?: Record<string, number>;
  onOpenEvent?: (event: CalendarEvent) => void;
  onCreateAt?: (zonedDay: Date, minutesOfDay: number) => void;
}

/** One wide column. The extra width is spent on description + location. */
export function DayView({
  anchorDate,
  events,
  timezone,
  timeFormat = '12h',
  pxPerHour,
  workingHoursStart,
  workingHoursEnd,
  workingDays,
  colorMode = 'type',
  colorIndexByUser,
  onOpenEvent,
  onCreateAt,
}: DayViewProps) {
  const zonedDay = useMemo(
    () => startOfDay(toZoned(anchorDate, timezone)),
    [anchorDate, timezone]
  );
  const dayKey = dayKeyOfZoned(zonedDay);

  const dayEvents = useMemo(
    () => events.filter((e) => getEventDayKeys(e, timezone).includes(dayKey)),
    [events, timezone, dayKey]
  );

  const lanes: TimeGridLane[] = useMemo(
    () => [
      {
        key: dayKey,
        zonedDay,
        primaryLabel: formatInZone(fromZoned(zonedDay, timezone), timezone, 'EEEE'),
        secondaryLabel: String(zonedDay.getDate()),
        events: dayEvents.filter((e) => !e.all_day),
      },
    ],
    [dayKey, zonedDay, timezone, dayEvents]
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
      detailed
      onOpenEvent={onOpenEvent}
      onCreateAt={(day, minutes) => onCreateAt?.(day, minutes)}
      headerExtra={
        <AllDayRow
          days={[zonedDay]}
          events={dayEvents.filter((e) => e.all_day)}
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

export default DayView;
