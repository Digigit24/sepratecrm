// src/components/calendar/TimeGridColumn.tsx
import { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { layoutDayColumn } from '@/utils/calendarLayout';
import {
  dayKeyOfZoned,
  isWorkingHour,
  minutesToPx,
  pxToSnappedMinutes,
  toZoned,
} from '@/utils/calendarTime';
import type { CalendarDropTarget } from '@/hooks/useCalendarDnd';
import type { CalendarEvent } from '@/types/calendar.types';
import { EventBlock } from './EventBlock';
import { NowIndicator } from './NowIndicator';

interface TimeGridColumnProps {
  /** Zoned date this column represents (see `calendarTime.ts`). */
  zonedDay: Date;
  events: CalendarEvent[];
  timezone: string;
  timeFormat?: '12h' | '24h';
  pxPerHour: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  workingDays: number[];
  colorMode?: 'type' | 'person';
  colorIndexByUser?: Record<string, number>;
  detailed?: boolean;
  /** Set in team-lane mode; a drop here reassigns the meeting's owner. */
  ownerUserId?: string | null;
  onOpenEvent?: (event: CalendarEvent) => void;
  onCreateAt?: (zonedDay: Date, minutesOfDay: number) => void;
  className?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

/**
 * One day (or one person) column of the time grid.
 *
 * Click-to-create resolves the slot from `offsetY / pxPerMinute` snapped to
 * 15 minutes, so clicking anywhere inside a quarter-hour band creates on that
 * band's boundary rather than at an arbitrary minute.
 */
export function TimeGridColumn({
  zonedDay,
  events,
  timezone,
  timeFormat = '12h',
  pxPerHour,
  workingHoursStart,
  workingHoursEnd,
  workingDays,
  colorMode = 'type',
  colorIndexByUser,
  detailed = false,
  ownerUserId,
  onOpenEvent,
  onCreateAt,
  className,
}: TimeGridColumnProps) {
  const dayKey = dayKeyOfZoned(zonedDay);
  const dropTarget: CalendarDropTarget = { kind: 'column', dayKey, zonedDay, ownerUserId };

  const { setNodeRef, isOver } = useDroppable({
    id: `column:${ownerUserId ?? 'self'}:${dayKey}`,
    data: dropTarget,
  });

  const positioned = useMemo(
    () => layoutDayColumn(events, zonedDay, timezone),
    [events, zonedDay, timezone]
  );

  // The "today" column only shows the now-line if today falls in this column,
  // evaluated in the CALENDAR's timezone, not the browser's.
  const nowZoned = toZoned(new Date(), timezone);
  const showNow = dayKeyOfZoned(nowZoned) === dayKey;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative flex-1 border-l border-border/60 bg-background transition-colors',
        isOver && 'bg-primary/[0.04]',
        className
      )}
      style={{ height: pxPerHour * 24 }}
      onClick={(e) => {
        if (!onCreateAt) return;
        const bounds = e.currentTarget.getBoundingClientRect();
        const minutes = pxToSnappedMinutes(e.clientY - bounds.top, pxPerHour);
        onCreateAt(zonedDay, Math.max(0, Math.min(24 * 60 - 15, minutes)));
      }}
      data-testid={`time-grid-column-${dayKey}`}
      data-today={isToday(zonedDay) ? 'true' : undefined}
    >
      {/* Hour rows + half-hour hairlines + working-hours tint. */}
      {HOURS.map((hour) => {
        const bandStart = new Date(zonedDay);
        bandStart.setHours(hour, 0, 0, 0);
        const working = isWorkingHour(bandStart, {
          workingHoursStart,
          workingHoursEnd,
          workingDays,
        });
        return (
          <div
            key={hour}
            className={cn(
              'absolute inset-x-0 border-t border-border/50',
              !working && 'bg-muted/30'
            )}
            style={{ top: minutesToPx(hour * 60, pxPerHour), height: pxPerHour }}
          >
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border/30" />
          </div>
        );
      })}

      {showNow ? <NowIndicator timezone={timezone} pxPerHour={pxPerHour} /> : null}

      {positioned.map((item) => (
        <EventBlock
          key={item.event.id}
          positioned={item}
          timezone={timezone}
          timeFormat={timeFormat}
          pxPerHour={pxPerHour}
          colorMode={colorMode}
          colorIndexByUser={colorIndexByUser}
          detailed={detailed}
          onOpen={onOpenEvent}
        />
      ))}
    </div>
  );
}

export default TimeGridColumn;
