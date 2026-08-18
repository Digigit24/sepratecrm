/**
 * Drag-to-move, drag-to-resize and the recurrence-scope gate.
 *
 * LIBRARY SPLIT (deliberate, see plan §C.1)
 * -----------------------------------------
 * - **Move** uses `@dnd-kit/core` + `@dnd-kit/modifiers`. A calendar's drop
 *   targets (day cell, time slot, person lane) are free-form, with no index
 *   semantics — that is `@dnd-kit`'s model, and it is already the idiom in
 *   `crm/SortableFieldConfigTable.tsx`. The kanban boards use
 *   `@hello-pangea/dnd` because they model *ordered lists*; we do not.
 * - **Resize** uses plain pointer events. `@dnd-kit` has no resize primitive,
 *   so `setPointerCapture` + a `pointermove` listener computing
 *   `round(deltaY / pxPerMinute / 15) * 15` is both smaller and more precise.
 *
 * The write flow copies `TaskKanbanBoard.tsx`: optimistic `mutate` →
 * service call → `toast` → revalidate, with rollback on failure.
 */

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import { mutate as globalMutate } from 'swr';
import { addDays, startOfDay } from 'date-fns';
import { meetingService } from '@/services/meeting.service';
import { calendarService } from '@/services/calendarService';
import type {
  CalendarEvent,
  CalendarRangeResponse,
  RecurrenceEditScope,
} from '@/types/calendar.types';
import type { MeetingUpdateData } from '@/types/meeting.types';
import { CALENDAR_EVENTS_KEY } from '@/hooks/useCalendar';
import {
  MINUTES_PER_SLOT,
  eventDurationMinutes,
  minutesFromMidnight,
  parseInstant,
  pxToMinutes,
  snapToSlot,
  setMinutesOfDay,
  toZoned,
  zonedToIso,
} from '@/utils/calendarTime';

/** What a droppable advertises about itself. */
export interface CalendarDropTarget {
  kind: 'day' | 'column';
  /** `yyyy-MM-dd` in the viewer's timezone. */
  dayKey: string;
  /** The zoned date this cell/column represents. */
  zonedDay: Date;
  /** Set in team-lane mode; dropping reassigns the owner. */
  ownerUserId?: string | null;
}

export interface PendingChange {
  event: CalendarEvent;
  patch: MeetingUpdateData;
  label: string;
}

export interface ResizePreview {
  eventId: string;
  startDeltaMinutes: number;
  endDeltaMinutes: number;
}

/** Only meetings are reschedulable by drag, and only when the SERVER says so. */
export const isDraggableEvent = (event: CalendarEvent): boolean =>
  event.source === 'meeting' && !!event.can_edit && !event.redacted;

interface UseCalendarDndOptions {
  timezone: string;
  pxPerHour: number;
  /** Ask the server whether the new time double-books anyone. */
  conflictUserIds?: string[];
}

export const useCalendarDnd = ({
  timezone,
  pxPerHour,
  conflictUserIds,
}: UseCalendarDndOptions) => {
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [resizePreview, setResizePreview] = useState<ResizePreview | null>(null);
  const resizeState = useRef<{
    event: CalendarEvent;
    edge: 'start' | 'end';
    originY: number;
  } | null>(null);

  const sensors = useSensors(
    // 5px activation distance keeps a plain click from becoming a drag.
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor)
  );

  /** Optimistically patch every cached range that contains this event. */
  const patchCaches = useCallback(
    (eventId: string, updater: (e: CalendarEvent) => CalendarEvent) =>
      globalMutate(
        (key) => Array.isArray(key) && key[0] === CALENDAR_EVENTS_KEY,
        (current?: CalendarRangeResponse) => {
          if (!current?.events) return current;
          if (!current.events.some((e) => e.id === eventId)) return current;
          return {
            ...current,
            events: current.events.map((e) => (e.id === eventId ? updater(e) : e)),
          };
        },
        { revalidate: false }
      ),
    []
  );

  const revalidateAll = useCallback(
    () =>
      globalMutate(
        (key) => Array.isArray(key) && key[0] === CALENDAR_EVENTS_KEY,
        undefined,
        { revalidate: true }
      ),
    []
  );

  /**
   * Commit a reschedule. `editScope` is only sent for recurring meetings; a
   * one-off meeting never carries recurrence params.
   */
  const commit = useCallback(
    async (change: PendingChange, editScope?: RecurrenceEditScope) => {
      const { event, patch, label } = change;
      const previous = { start_at: event.start_at, end_at: event.end_at };

      await patchCaches(event.id, (e) => ({
        ...e,
        start_at: patch.start_at ?? e.start_at,
        end_at: patch.end_at ?? e.end_at,
        owner_user_id: patch.owner_user_id ?? e.owner_user_id,
      }));

      try {
        await meetingService.patchMeeting(
          event.source_id,
          patch,
          editScope
            ? { editScope, occurrenceStart: event.occurrence_start ?? event.start_at }
            : undefined
        );
        toast.success(label);
        void revalidateAll();

        // Conflict check runs in parallel and only ever WARNS (§B.4/§C.6).
        if (patch.start_at && patch.end_at) {
          void calendarService
            .checkConflicts({
              start_at: patch.start_at,
              end_at: patch.end_at,
              user_ids: conflictUserIds?.length
                ? conflictUserIds
                : event.owner_user_id
                  ? [event.owner_user_id]
                  : undefined,
              exclude_meeting_id: event.source_id,
            })
            .then((result) => {
              if (result.has_conflicts && result.conflicts.length) {
                toast.warning(
                  `Overlaps ${result.conflicts.length} other ${
                    result.conflicts.length === 1 ? 'event' : 'events'
                  }`
                );
              }
            })
            .catch(() => {
              /* conflict check is advisory — never surface its failure */
            });
        }
      } catch (error) {
        // Roll the optimistic edit back, then tell the user.
        await patchCaches(event.id, (e) => ({ ...e, ...previous }));
        toast.error((error as Error)?.message || 'Failed to reschedule');
        void revalidateAll();
      }
    },
    [patchCaches, revalidateAll, conflictUserIds]
  );

  /**
   * Route a change through the recurrence scope dialog when needed.
   * A recurring meeting must never be silently mutated across its whole series.
   */
  const requestChange = useCallback(
    (change: PendingChange) => {
      const recurring = !!change.event.is_recurring || !!change.event.series_id;
      if (recurring) {
        setPendingChange(change);
        return;
      }
      void commit(change);
    },
    [commit]
  );

  const resolveScope = useCallback(
    (scope: RecurrenceEditScope) => {
      const change = pendingChange;
      setPendingChange(null);
      if (change) void commit(change, scope);
    },
    [pendingChange, commit]
  );

  const cancelScope = useCallback(() => setPendingChange(null), []);

  /* ---------------------------------------------------------------- *
   * dnd-kit handlers                                                  *
   * ---------------------------------------------------------------- */

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const event = e.active.data.current?.event as CalendarEvent | undefined;
    setActiveEvent(event ?? null);
  }, []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveEvent(null);
      const event = e.active.data.current?.event as CalendarEvent | undefined;
      const target = e.over?.data.current as CalendarDropTarget | undefined;
      if (!event || !target || !isDraggableEvent(event)) return;

      const start = parseInstant(event.start_at);
      if (!start) return;
      const durationMinutes = eventDurationMinutes(event);

      let newStartIso: string;
      if (target.kind === 'day') {
        // Month view: change the DATE, preserve the wall-clock time.
        const zonedStart = toZoned(start, timezone);
        const moved = new Date(target.zonedDay);
        moved.setHours(zonedStart.getHours(), zonedStart.getMinutes(), 0, 0);
        newStartIso = zonedToIso(moved, timezone);
      } else {
        // Time grid: the column gives the day, the vertical delta the minutes.
        const zonedStart = toZoned(start, timezone);
        const deltaMinutes = snapToSlot(
          pxToMinutes(e.delta.y, pxPerHour),
          MINUTES_PER_SLOT
        );
        const minutesOfDay = Math.max(
          0,
          Math.min(24 * 60 - MINUTES_PER_SLOT, minutesFromMidnight(zonedStart) + deltaMinutes)
        );
        newStartIso = setMinutesOfDay(target.zonedDay, minutesOfDay, timezone);
      }

      const newStart = parseInstant(newStartIso);
      if (!newStart) return;
      const newEndIso = new Date(newStart.getTime() + durationMinutes * 60000).toISOString();

      const ownerChanged =
        !!target.ownerUserId &&
        !!event.owner_user_id &&
        String(target.ownerUserId) !== String(event.owner_user_id);

      if (newStartIso === event.start_at && !ownerChanged) return;

      const patch: MeetingUpdateData = { start_at: newStartIso, end_at: newEndIso };
      if (ownerChanged) patch.owner_user_id = target.ownerUserId as string;

      requestChange({
        event,
        patch,
        label: ownerChanged ? 'Meeting reassigned' : 'Meeting rescheduled',
      });
    },
    [timezone, pxPerHour, requestChange]
  );

  const handleDragCancel = useCallback(() => setActiveEvent(null), []);

  /* ---------------------------------------------------------------- *
   * Pointer-event resize                                              *
   * ---------------------------------------------------------------- */

  const startResize = useCallback(
    (event: CalendarEvent, edge: 'start' | 'end', e: ReactPointerEvent<HTMLElement>) => {
      if (!isDraggableEvent(event)) return;
      e.preventDefault();
      e.stopPropagation();

      const element = e.currentTarget;
      try {
        element.setPointerCapture(e.pointerId);
      } catch {
        /* older browsers / synthetic events */
      }

      resizeState.current = { event, edge, originY: e.clientY };
      setResizePreview({ eventId: event.id, startDeltaMinutes: 0, endDeltaMinutes: 0 });

      const onMove = (moveEvent: PointerEvent) => {
        const state = resizeState.current;
        if (!state) return;
        const deltaMinutes = snapToSlot(
          pxToMinutes(moveEvent.clientY - state.originY, pxPerHour),
          MINUTES_PER_SLOT
        );
        setResizePreview({
          eventId: state.event.id,
          startDeltaMinutes: state.edge === 'start' ? deltaMinutes : 0,
          endDeltaMinutes: state.edge === 'end' ? deltaMinutes : 0,
        });
      };

      const onUp = (upEvent: PointerEvent) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        const state = resizeState.current;
        resizeState.current = null;
        setResizePreview(null);
        if (!state) return;

        const deltaMinutes = snapToSlot(
          pxToMinutes(upEvent.clientY - state.originY, pxPerHour),
          MINUTES_PER_SLOT
        );
        if (!deltaMinutes) return;

        const start = parseInstant(state.event.start_at);
        const end = parseInstant(state.event.end_at);
        if (!start || !end) return;

        let nextStart = start;
        let nextEnd = end;
        if (state.edge === 'start') {
          nextStart = new Date(start.getTime() + deltaMinutes * 60000);
          // Never let the handles cross: keep at least one slot of duration.
          if (nextStart.getTime() >= end.getTime() - MINUTES_PER_SLOT * 60000) {
            nextStart = new Date(end.getTime() - MINUTES_PER_SLOT * 60000);
          }
        } else {
          nextEnd = new Date(end.getTime() + deltaMinutes * 60000);
          if (nextEnd.getTime() <= start.getTime() + MINUTES_PER_SLOT * 60000) {
            nextEnd = new Date(start.getTime() + MINUTES_PER_SLOT * 60000);
          }
        }

        requestChange({
          event: state.event,
          patch: { start_at: nextStart.toISOString(), end_at: nextEnd.toISOString() },
          label: 'Meeting duration updated',
        });
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [pxPerHour, requestChange]
  );

  /** Convert an all-day event into a timed one on the same day (and back). */
  const setAllDay = useCallback(
    (event: CalendarEvent, allDay: boolean) => {
      if (!isDraggableEvent(event)) return;
      const start = parseInstant(event.start_at);
      if (!start) return;
      const zonedDay = startOfDay(toZoned(start, timezone));
      const patch: MeetingUpdateData = allDay
        ? {
            all_day: true,
            start_at: zonedToIso(zonedDay, timezone),
            // All-day end is EXCLUSIVE: midnight of the following day.
            end_at: zonedToIso(addDays(zonedDay, 1), timezone),
          }
        : {
            all_day: false,
            start_at: setMinutesOfDay(zonedDay, 9 * 60, timezone),
            end_at: setMinutesOfDay(zonedDay, 10 * 60, timezone),
          };
      requestChange({
        event,
        patch,
        label: allDay ? 'Changed to all-day' : 'Changed to a timed event',
      });
    },
    [timezone, requestChange]
  );

  return {
    sensors,
    activeEvent,
    pendingChange,
    resizePreview,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    startResize,
    setAllDay,
    resolveScope,
    cancelScope,
    requestChange,
  };
};

export type CalendarDndValue = ReturnType<typeof useCalendarDnd>;

/**
 * Shared so the deeply-nested `EventBlock` / `EventChip` can reach the resize
 * preview and handlers without threading props through five levels of grid.
 */
export const CalendarDndContext = createContext<CalendarDndValue | null>(null);

export const useCalendarDndContext = (): CalendarDndValue | null =>
  useContext(CalendarDndContext);
