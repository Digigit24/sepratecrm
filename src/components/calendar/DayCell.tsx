// src/components/calendar/DayCell.tsx
import { useDroppable } from '@dnd-kit/core';
import { isSameMonth, isToday } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { dayKeyOfZoned } from '@/utils/calendarTime';
import { sortEventsForDisplay } from '@/utils/calendarLayout';
import type { CalendarDropTarget } from '@/hooks/useCalendarDnd';
import type { CalendarEvent } from '@/types/calendar.types';
import { EventChip } from './EventChip';

interface DayCellProps {
  zonedDay: Date;
  monthAnchor: Date;
  /** Timed (non-spanning) events for this day only. */
  events: CalendarEvent[];
  /** Vertical space already used by spanning bars in this week row. */
  reservedLanes: number;
  timezone: string;
  timeFormat?: '12h' | '24h';
  colorMode?: 'type' | 'person';
  colorIndexByUser?: Record<string, number>;
  onOpenEvent?: (event: CalendarEvent) => void;
  onCreate?: (zonedDay: Date) => void;
}

const MAX_VISIBLE_CHIPS = 3;

/**
 * One cell of the month grid. Droppable, so a chip dragged here moves the
 * meeting by whole days while preserving its time of day.
 */
export function DayCell({
  zonedDay,
  monthAnchor,
  events,
  reservedLanes,
  timezone,
  timeFormat = '12h',
  colorMode = 'type',
  colorIndexByUser,
  onOpenEvent,
  onCreate,
}: DayCellProps) {
  const dayKey = dayKeyOfZoned(zonedDay);
  const dropTarget: CalendarDropTarget = { kind: 'day', dayKey, zonedDay };

  const { setNodeRef, isOver } = useDroppable({ id: `day:${dayKey}`, data: dropTarget });

  const sorted = sortEventsForDisplay(events);
  const visible = sorted.slice(0, MAX_VISIBLE_CHIPS);
  const overflow = sorted.slice(MAX_VISIBLE_CHIPS);
  const outsideMonth = !isSameMonth(zonedDay, monthAnchor);
  const today = isToday(zonedDay);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'group relative flex min-h-0 flex-col gap-0.5 bg-background p-1 transition-colors',
        outsideMonth && 'bg-muted/20',
        isOver && 'bg-primary/[0.06] ring-1 ring-inset ring-primary/30'
      )}
      onClick={() => onCreate?.(zonedDay)}
      data-testid={`day-cell-${dayKey}`}
      data-outside-month={outsideMonth ? 'true' : undefined}
    >
      <div className="flex flex-shrink-0 items-center justify-between">
        <span
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium tabular-nums transition-colors',
            today
              ? 'bg-primary text-primary-foreground'
              : outsideMonth
                ? 'text-muted-foreground/60'
                : 'text-foreground'
          )}
        >
          {zonedDay.getDate()}
        </span>
      </div>

      {/* Space reserved for the week row's spanning bars. */}
      {reservedLanes > 0 ? (
        <div className="flex-shrink-0" style={{ height: reservedLanes * 20 }} aria-hidden="true" />
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
        {visible.map((event) => (
          <EventChip
            key={event.id}
            event={event}
            timezone={timezone}
            timeFormat={timeFormat}
            colorMode={colorMode}
            colorIndexByUser={colorIndexByUser}
            variant="month"
            onOpen={onOpenEvent}
          />
        ))}

        {overflow.length ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="rounded-[4px] px-1.5 text-left text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                +{overflow.length} more
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-2" onClick={(e) => e.stopPropagation()}>
              <p className="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {dayKey}
              </p>
              <ScrollArea className="max-h-72">
                <div className="space-y-1 pr-2">
                  {sorted.map((event) => (
                    <EventChip
                      key={event.id}
                      event={event}
                      timezone={timezone}
                      timeFormat={timeFormat}
                      colorMode={colorMode}
                      colorIndexByUser={colorIndexByUser}
                      variant="agenda"
                      onOpen={onOpenEvent}
                    />
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
    </div>
  );
}

export default DayCell;
