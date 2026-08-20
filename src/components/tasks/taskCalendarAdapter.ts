// src/components/tasks/taskCalendarAdapter.ts
//
// Task -> CalendarEvent, so the existing calendar grid can render tasks without
// a second grid being written.
//
// `CalendarEvent` already models `source: 'task'` (with a `due_at` field and a
// `task` colour key), so this conforms to an envelope that was designed for it
// rather than bending a meetings-only type.

import { startOfDay } from 'date-fns';
import { fromZoned, safeTimeZone, toZoned } from '@/utils/calendarTime';
import type { CalendarEvent } from '@/types/calendar.types';
import type { Task } from '@/types/crmTypes';
import { isTaskDone } from '@/utils/taskGrouping';

/**
 * A due date is a deadline, so each task becomes a one-day all-day bar.
 *
 * `end_at` is EXCLUSIVE for all-day events -- that is `getEventDayKeys()`'s
 * convention -- so a single-day task ends at 00:00 the following day. The
 * next-day calculation goes through `startOfDay(+26h)` rather than `+24h` so a
 * DST spring-forward cannot land it back on the same calendar day.
 */
export const taskToCalendarEvent = (task: Task, viewerTimeZone: string): CalendarEvent | null => {
  if (!task.due_date) return null;

  const tz = safeTimeZone(task.is_all_day ? task.timezone || viewerTimeZone : viewerTimeZone);
  const zonedDue = toZoned(task.due_date, tz);
  const dayStart = startOfDay(zonedDue);
  const nextDay = startOfDay(new Date(dayStart.getTime() + 26 * 60 * 60 * 1000));

  return {
    id: `task:${task.id}`,
    source: 'task',
    source_id: task.id,
    title: task.title,
    description: task.description,
    start_at: fromZoned(dayStart, tz).toISOString(),
    end_at: fromZoned(nextDay, tz).toISOString(),
    all_day: true,
    timezone: tz,
    due_at: task.due_date,
    color_key: 'task',
    owner_user_id: task.owner_user_id,
    assignee_user_id: task.assignee_user_id,
    can_edit: !isTaskDone(task),
  } as CalendarEvent;
};
