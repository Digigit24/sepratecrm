// src/components/calendar/EventChip.tsx
import { useDraggable } from '@dnd-kit/core';
import { Bell, Lock, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getEventColor } from '@/lib/calendarColors';
import { formatEventStart } from '@/utils/calendarTime';
import { isDraggableEvent } from '@/hooks/useCalendarDnd';
import type { CalendarEvent } from '@/types/calendar.types';
import { EventHoverCard } from './EventHoverCard';

export interface EventChipProps {
  event: CalendarEvent;
  timezone: string;
  timeFormat?: '12h' | '24h';
  /** `person` in team modes; the type is then shown by the left stripe. */
  colorMode?: 'type' | 'person';
  colorIndexByUser?: Record<string, number>;
  variant?: 'month' | 'allday' | 'agenda';
  /** Continuation arrows for a multi-day bar clipped by the week boundary. */
  continuesBefore?: boolean;
  continuesAfter?: boolean;
  onOpen?: (event: CalendarEvent) => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The compact chip used in month cells, the all-day lane and the agenda.
 *
 * PRIVATE EVENTS. `event.title` has already been replaced with "Busy" upstream
 * by `redactFeed()`, so there is nothing here to leak. The chip additionally
 * refuses to be draggable or clickable when `redacted` is set, so a redacted
 * row can never open a detail drawer.
 */
export function EventChip({
  event,
  timezone,
  timeFormat = '12h',
  colorMode = 'type',
  colorIndexByUser,
  variant = 'month',
  continuesBefore,
  continuesAfter,
  onOpen,
  className,
  style,
}: EventChipProps) {
  const color = getEventColor(event, colorMode, colorIndexByUser);
  const canDrag = isDraggableEvent(event);
  const isRedactedRow = !!event.redacted;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chip:${event.id}`,
    data: { event },
    disabled: !canDrag,
  });

  const timeLabel = formatEventStart(event, timezone, timeFormat);

  const chip = (
    <div
      ref={setNodeRef}
      role={isRedactedRow ? undefined : 'button'}
      tabIndex={isRedactedRow ? -1 : 0}
      aria-label={isRedactedRow ? 'Busy' : event.title}
      aria-disabled={isRedactedRow || undefined}
      onClick={(e) => {
        e.stopPropagation();
        if (!isRedactedRow) onOpen?.(event);
      }}
      onKeyDown={(e) => {
        if (isRedactedRow) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onOpen?.(event);
        }
      }}
      className={cn(
        'group flex min-w-0 items-center gap-1 rounded-[4px] px-1.5 text-[11px] leading-none transition-colors',
        variant === 'agenda' ? 'h-7 gap-2 rounded-md px-2 text-xs' : 'h-[18px]',
        color.chip,
        // In person-colour mode the TYPE is signalled by a 2px left stripe.
        colorMode === 'person' && 'border-l-2',
        colorMode === 'person' && getEventColor(event, 'type').border,
        continuesBefore && 'rounded-l-none',
        continuesAfter && 'rounded-r-none',
        canDrag ? 'cursor-grab active:cursor-grabbing' : isRedactedRow ? 'cursor-default' : 'cursor-pointer',
        isDragging && 'opacity-40',
        !isRedactedRow && 'hover:brightness-95 dark:hover:brightness-110',
        className
      )}
      style={style}
      {...(canDrag ? listeners : {})}
      {...(canDrag ? attributes : {})}
      data-testid="calendar-event-chip"
      data-redacted={isRedactedRow ? 'true' : undefined}
    >
      {isRedactedRow ? <Lock className="h-2.5 w-2.5 flex-shrink-0" /> : null}
      {!isRedactedRow && event.is_recurring ? <Repeat className="h-2.5 w-2.5 flex-shrink-0 opacity-70" /> : null}
      {timeLabel && !event.all_day ? (
        <span className="flex-shrink-0 font-medium tabular-nums opacity-80">{timeLabel}</span>
      ) : null}
      <span className="min-w-0 flex-1 truncate font-medium">{event.title}</span>
      {!isRedactedRow && event.has_reminders ? (
        <Bell className="h-2.5 w-2.5 flex-shrink-0 opacity-60" />
      ) : null}
    </div>
  );

  // A redacted event gets NO hover card: there is nothing safe to preview.
  if (isRedactedRow) return chip;

  return (
    <EventHoverCard event={event} timezone={timezone} timeFormat={timeFormat}>
      {chip}
    </EventHoverCard>
  );
}

export default EventChip;
