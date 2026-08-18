// src/components/calendar/EventBlock.tsx
import { useDraggable } from '@dnd-kit/core';
import { Bell, Lock, MapPin, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getEventColor } from '@/lib/calendarColors';
import { formatEventTimeRange, minutesToPx } from '@/utils/calendarTime';
import { isDraggableEvent, useCalendarDndContext } from '@/hooks/useCalendarDnd';
import type { CalendarEvent } from '@/types/calendar.types';
import type { PositionedEvent } from '@/utils/calendarLayout';
import { EventHoverCard } from './EventHoverCard';

interface EventBlockProps {
  positioned: PositionedEvent;
  timezone: string;
  timeFormat?: '12h' | '24h';
  pxPerHour: number;
  colorMode?: 'type' | 'person';
  colorIndexByUser?: Record<string, number>;
  /** Show description + attendee count; day view has room, week view does not. */
  detailed?: boolean;
  onOpen?: (event: CalendarEvent) => void;
}

/**
 * A positioned block inside `TimeGrid`.
 *
 * Resize is plain pointer events (see `useCalendarDnd`): the handles call
 * `startResize` and the live preview is read back from `resizePreview` so the
 * block visibly follows the cursor before anything is committed.
 */
export function EventBlock({
  positioned,
  timezone,
  timeFormat = '12h',
  pxPerHour,
  colorMode = 'type',
  colorIndexByUser,
  detailed = false,
  onOpen,
}: EventBlockProps) {
  const { event, startMinutes, durationMinutes, left, width, zIndex } = positioned;
  const dnd = useCalendarDndContext();
  const color = getEventColor(event, colorMode, colorIndexByUser);
  const canEdit = isDraggableEvent(event);
  const isRedactedRow = !!event.redacted;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `block:${event.id}`,
    data: { event },
    disabled: !canEdit,
  });

  const preview = dnd?.resizePreview?.eventId === event.id ? dnd.resizePreview : null;
  const previewStart = startMinutes + (preview?.startDeltaMinutes ?? 0);
  const previewDuration =
    durationMinutes - (preview?.startDeltaMinutes ?? 0) + (preview?.endDeltaMinutes ?? 0);

  const top = minutesToPx(Math.max(0, previewStart), pxPerHour);
  const height = Math.max(minutesToPx(15, pxPerHour), minutesToPx(previewDuration, pxPerHour));
  const compact = height < 34;

  const block = (
    <div
      ref={setNodeRef}
      role={isRedactedRow ? undefined : 'button'}
      tabIndex={isRedactedRow ? -1 : 0}
      aria-label={isRedactedRow ? 'Busy' : event.title}
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
        'group absolute overflow-hidden rounded-md border border-background/60 px-1.5 py-0.5 text-[11px] shadow-sm transition-colors',
        color.chip,
        colorMode === 'person' && 'border-l-2',
        colorMode === 'person' && getEventColor(event, 'type').border,
        canEdit ? 'cursor-grab active:cursor-grabbing' : isRedactedRow ? 'cursor-default' : 'cursor-pointer',
        isDragging && 'opacity-40',
        preview && 'ring-1 ring-primary/50'
      )}
      style={{
        top,
        height,
        left: `calc(${left * 100}% + 2px)`,
        width: `calc(${width * 100}% - 4px)`,
        zIndex: preview ? 60 : zIndex,
      }}
      {...(canEdit ? listeners : {})}
      {...(canEdit ? attributes : {})}
      data-testid="calendar-event-block"
      data-redacted={isRedactedRow ? 'true' : undefined}
    >
      {/* Top resize handle — only when this row is actually editable. */}
      {canEdit ? (
        <div
          role="separator"
          aria-label="Resize start"
          className="absolute inset-x-0 top-0 h-1.5 cursor-ns-resize opacity-0 transition-opacity group-hover:opacity-100"
          onPointerDown={(e) => dnd?.startResize(event, 'start', e)}
        >
          <div className="mx-auto mt-[2px] h-0.5 w-6 rounded-full bg-current opacity-50" />
        </div>
      ) : null}

      <div className={cn('flex min-w-0 items-center gap-1', compact && 'leading-none')}>
        {isRedactedRow ? <Lock className="h-2.5 w-2.5 flex-shrink-0" /> : null}
        {!isRedactedRow && event.is_recurring ? (
          <Repeat className="h-2.5 w-2.5 flex-shrink-0 opacity-70" />
        ) : null}
        <span className="min-w-0 flex-1 truncate font-medium">{event.title}</span>
        {!isRedactedRow && event.has_reminders ? (
          <Bell className="h-2.5 w-2.5 flex-shrink-0 opacity-60" />
        ) : null}
      </div>

      {!compact ? (
        <div className="truncate opacity-75">{formatEventTimeRange(event, timezone, timeFormat)}</div>
      ) : null}

      {detailed && !compact && !isRedactedRow ? (
        <div className="mt-0.5 space-y-0.5 opacity-75">
          {event.location ? (
            <div className="flex items-center gap-1 truncate">
              <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
              <span className="truncate">{event.location}</span>
            </div>
          ) : null}
          {event.description ? <p className="line-clamp-2">{event.description}</p> : null}
        </div>
      ) : null}

      {/* Bottom resize handle. */}
      {canEdit ? (
        <div
          role="separator"
          aria-label="Resize end"
          className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize opacity-0 transition-opacity group-hover:opacity-100"
          onPointerDown={(e) => dnd?.startResize(event, 'end', e)}
        >
          <div className="mx-auto mt-[2px] h-0.5 w-6 rounded-full bg-current opacity-50" />
        </div>
      ) : null}
    </div>
  );

  if (isRedactedRow) return block;

  return (
    <EventHoverCard event={event} timezone={timezone} timeFormat={timeFormat}>
      {block}
    </EventHoverCard>
  );
}

export default EventBlock;
