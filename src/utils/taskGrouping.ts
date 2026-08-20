// src/utils/taskGrouping.ts
//
// Pure bucketing for the one-page task manager: Overdue / Today / This week /
// Later / Done.
//
// WHY THIS IS TIMEZONE-AWARE
// --------------------------
// A due date is an instant, but "is it due today?" is a wall-clock question in
// the *viewer's* zone. A task due 2026-03-10T02:00:00Z is the 10th in UTC but
// still the 9th in New York -- bucketing it with plain `date-fns` on the raw
// instant files it under the wrong day for half the planet. Everything here
// therefore goes through `toZoned()`/`dayKeyInZone()` from calendarTime.ts and
// compares `yyyy-MM-dd` day keys, which sort correctly as plain strings.
//
// All-day tasks are floating dates: "9 September" means the 9th for everybody.
// They are keyed in the *task's own* zone (`task.timezone`), matching the
// convention `getEventDayKeys()` already established for the calendar.
//
// This module is deliberately free of React and of any network access so the
// bucket rules can be tested directly under a non-UTC timezone.

import { addDays, endOfWeek, startOfDay } from 'date-fns';
import {
  dayKeyInZone,
  dayKeyOfZoned,
  fromZoned,
  safeTimeZone,
  toZoned,
  type WeekStartsOn,
} from '@/utils/calendarTime';
import { TaskStatusEnum, type Task } from '@/types/crmTypes';

export type TaskBucketId = 'overdue' | 'today' | 'this_week' | 'later' | 'done';

export interface TaskBucketMeta {
  id: TaskBucketId;
  label: string;
  /** Shown under the group header when the group is empty. */
  emptyHint: string;
  /** Whether a row may be dropped into this group to re-date it. */
  droppable: boolean;
}

/** Display order of the groups on the page. */
export const TASK_BUCKETS: readonly TaskBucketMeta[] = [
  {
    id: 'overdue',
    label: 'Overdue',
    emptyHint: 'Nothing overdue.',
    // You cannot make something overdue by dragging it there.
    droppable: false,
  },
  { id: 'today', label: 'Today', emptyHint: 'Nothing due today.', droppable: true },
  { id: 'this_week', label: 'This week', emptyHint: 'Nothing else this week.', droppable: true },
  { id: 'later', label: 'Later', emptyHint: 'Nothing scheduled later.', droppable: true },
  { id: 'done', label: 'Done', emptyHint: 'Nothing completed yet.', droppable: true },
] as const;

export const TASK_BUCKET_IDS = TASK_BUCKETS.map((b) => b.id);

export interface BucketOptions {
  /** "Now" as a real UTC instant. Injected so tests are deterministic. */
  now?: Date;
  /** Viewer's IANA zone. Invalid/absent falls back to UTC via `safeTimeZone`. */
  timeZone?: string;
  weekStartsOn?: WeekStartsOn;
}

interface ResolvedOptions {
  now: Date;
  timeZone: string;
  weekStartsOn: WeekStartsOn;
}

const resolve = (opts?: BucketOptions): ResolvedOptions => ({
  now: opts?.now ?? new Date(),
  timeZone: safeTimeZone(opts?.timeZone),
  weekStartsOn: opts?.weekStartsOn ?? 1,
});

/** DONE and CANCELLED are both "off the list" for grouping purposes. */
export const isTaskDone = (task: Pick<Task, 'status'>): boolean =>
  task.status === TaskStatusEnum.DONE || task.status === TaskStatusEnum.CANCELLED;

export const isTaskOpen = (task: Pick<Task, 'status'>): boolean => !isTaskDone(task);

/**
 * The `yyyy-MM-dd` key a task's deadline falls on.
 *
 * Timed tasks are keyed in the viewer's zone; all-day tasks in their own zone,
 * because an all-day date is floating and must not shift across the date line.
 */
export const taskDueDayKey = (
  task: Pick<Task, 'due_date' | 'is_all_day' | 'timezone'>,
  viewerTimeZone: string
): string | null => {
  if (!task.due_date) return null;
  const zone = task.is_all_day ? safeTimeZone(task.timezone) : safeTimeZone(viewerTimeZone);
  try {
    return dayKeyInZone(task.due_date, zone);
  } catch {
    return null;
  }
};

/** Today's key and the last key still counted as "this week", in the viewer's zone. */
export const bucketBoundaries = (opts?: BucketOptions) => {
  const { now, timeZone, weekStartsOn } = resolve(opts);
  const zonedNow = toZoned(now, timeZone);
  const todayKey = dayKeyOfZoned(zonedNow);
  const weekEndKey = dayKeyOfZoned(endOfWeek(zonedNow, { weekStartsOn }));
  return { todayKey, weekEndKey, timeZone, weekStartsOn, now };
};

/**
 * Which group a single task belongs in.
 *
 * A task with no due date is "Later" -- the page shows exactly the five groups
 * the product asked for, so undated work parks at the bottom rather than
 * getting a sixth header nobody asked for.
 */
export const bucketForTask = (task: Task, opts?: BucketOptions): TaskBucketId => {
  if (isTaskDone(task)) return 'done';

  const { todayKey, weekEndKey, timeZone } = bucketBoundaries(opts);
  const dueKey = taskDueDayKey(task, timeZone);

  if (!dueKey) return 'later';
  if (dueKey < todayKey) return 'overdue';
  if (dueKey === todayKey) return 'today';
  if (dueKey <= weekEndKey) return 'this_week';
  return 'later';
};

export type GroupedTasks = Record<TaskBucketId, Task[]>;

const emptyGroups = (): GroupedTasks => ({
  overdue: [],
  today: [],
  this_week: [],
  later: [],
  done: [],
});

/**
 * Sort inside a group: explicit `order_index` first (that is what drag-to-
 * reorder writes), then soonest deadline, then undated, then newest id last so
 * the order is always total and therefore stable across re-renders.
 */
export const compareWithinBucket = (a: Task, b: Task): number => {
  const ai = a.order_index;
  const bi = b.order_index;
  if (typeof ai === 'number' && typeof bi === 'number' && ai !== bi) return ai - bi;
  if (typeof ai === 'number' && typeof bi !== 'number') return -1;
  if (typeof ai !== 'number' && typeof bi === 'number') return 1;

  const ad = a.due_date ? Date.parse(a.due_date) : Number.POSITIVE_INFINITY;
  const bd = b.due_date ? Date.parse(b.due_date) : Number.POSITIVE_INFINITY;
  if (ad !== bd) return ad - bd;

  return a.id - b.id;
};

/** Buckets a flat list, sorted within each group. */
export const groupTasks = (tasks: Task[], opts?: BucketOptions): GroupedTasks => {
  const groups = emptyGroups();
  for (const task of tasks) groups[bucketForTask(task, opts)].push(task);
  for (const id of TASK_BUCKET_IDS) groups[id].sort(compareWithinBucket);
  return groups;
};

/** Count of genuinely late work -- drives the red weight on the Overdue header. */
export const overdueCount = (tasks: Task[], opts?: BucketOptions): number =>
  tasks.reduce((n, t) => (bucketForTask(t, opts) === 'overdue' ? n + 1 : n), 0);

/**
 * Folds a `my-day/` response into the same shape client-side grouping produces,
 * so the rest of the UI never has to care which path the data came from.
 */
export const groupsFromMyDay = (payload: {
  overdue?: Task[];
  today?: Task[];
  this_week?: Task[];
  later?: Task[];
  done_today?: Task[];
}): GroupedTasks => ({
  overdue: payload.overdue ?? [],
  today: payload.today ?? [],
  this_week: payload.this_week ?? [],
  later: payload.later ?? [],
  done: payload.done_today ?? [],
});

/**
 * The due date a task should get when it is dragged into `bucket`.
 *
 * Returns `undefined` when the drop implies no date change (Done is a status
 * change, Overdue is not a drop target). Time-of-day is preserved when the task
 * already had one, so dragging a "call at 15:00" from Later to Today keeps 15:00
 * rather than silently becoming midnight.
 */
export const dueDateForBucket = (
  bucket: TaskBucketId,
  task: Task,
  opts?: BucketOptions
): string | null | undefined => {
  const { now, timeZone, weekStartsOn } = resolve(opts);
  if (bucket === 'done' || bucket === 'overdue') return undefined;

  const zonedNow = toZoned(now, timeZone);
  let targetDay: Date;
  if (bucket === 'today') {
    targetDay = startOfDay(zonedNow);
  } else if (bucket === 'this_week') {
    // Land on the end of the current week, but never in the past.
    const weekEnd = startOfDay(endOfWeek(zonedNow, { weekStartsOn }));
    targetDay = weekEnd < startOfDay(zonedNow) ? startOfDay(zonedNow) : weekEnd;
  } else {
    // "Later" = the day after this week ends, so it cannot fall back into
    // this_week the moment it is dropped.
    targetDay = addDays(startOfDay(endOfWeek(zonedNow, { weekStartsOn })), 1);
  }

  // Preserve the existing wall-clock time when there is one.
  const previous = task.due_date ? toZoned(task.due_date, timeZone) : null;
  const withTime = previous
    ? new Date(
        targetDay.getFullYear(),
        targetDay.getMonth(),
        targetDay.getDate(),
        previous.getHours(),
        previous.getMinutes(),
        0,
        0
      )
    : new Date(
        targetDay.getFullYear(),
        targetDay.getMonth(),
        targetDay.getDate(),
        17,
        0,
        0,
        0
      );

  return fromZoned(withTime, timeZone).toISOString();
};

/** Human label for a due date, e.g. "Today", "Tomorrow", "Mon 14 Sep". */
export const formatDueLabel = (
  task: Pick<Task, 'due_date' | 'is_all_day' | 'timezone'>,
  opts?: BucketOptions
): string => {
  if (!task.due_date) return 'No date';
  const { now, timeZone } = resolve(opts);
  const zonedNow = toZoned(now, timeZone);
  const todayKey = dayKeyOfZoned(zonedNow);
  const tomorrowKey = dayKeyOfZoned(addDays(zonedNow, 1));
  const yesterdayKey = dayKeyOfZoned(addDays(zonedNow, -1));
  const key = taskDueDayKey(task, timeZone);
  if (!key) return 'No date';
  if (key === todayKey) return 'Today';
  if (key === tomorrowKey) return 'Tomorrow';
  if (key === yesterdayKey) return 'Yesterday';

  const zone = task.is_all_day ? safeTimeZone(task.timezone) : timeZone;
  const zoned = toZoned(task.due_date, zone);
  const sameYear = zoned.getFullYear() === zonedNow.getFullYear();
  return zoned.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
};

/**
 * `yyyy-MM-dd` for a date input, in the zone the task is expressed in, so the
 * inline date editor round-trips without drifting a day.
 */
export const dueDateInputValue = (task: Task, timeZone?: string): string =>
  taskDueDayKey(task, safeTimeZone(timeZone)) ?? '';

/** Turns a `yyyy-MM-dd` (+ optional `HH:mm`) back into a UTC instant. */
export const dueDateFromInput = (
  dayKey: string,
  timeOfDay: string | null | undefined,
  timeZone?: string
): string | null => {
  if (!dayKey) return null;
  const [y, m, d] = dayKey.split('-').map(Number);
  if (!y || !m || !d) return null;
  const [hh, mm] = (timeOfDay || '17:00').split(':').map(Number);
  const zoned = new Date(y, m - 1, d, Number.isFinite(hh) ? hh : 17, Number.isFinite(mm) ? mm : 0, 0, 0);
  return fromZoned(zoned, safeTimeZone(timeZone)).toISOString();
};

/** `HH:mm` of a task's deadline in the given zone, for the time input. */
export const dueTimeInputValue = (task: Task, timeZone?: string): string => {
  if (!task.due_date) return '';
  const zoned = toZoned(task.due_date, safeTimeZone(timeZone));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(zoned.getHours())}:${pad(zoned.getMinutes())}`;
};
