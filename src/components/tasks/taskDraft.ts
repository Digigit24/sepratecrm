// src/components/tasks/taskDraft.ts
//
// The ONE place where "a task as the API stores it" is converted to and from
// "a task as a form holds it".
//
// There used to be two drawers (TaskFormDrawer + TasksFormDrawer/TaskBasicInfo)
// that each re-implemented this mapping, and they had already drifted: one sent
// `owner_user_id`, the other sent `reporter_user_id`; one required a lead, the
// other made it optional; both split `due_date` on 'T' and threw the time away.
// Consolidating them meant first consolidating this, so the drawer and the side
// panel cannot drift again.

import {
  PriorityEnum,
  TaskStatusEnum,
  type CreateTaskPayload,
  type Task,
  type TaskRelatedType,
  type UpdateTaskPayload,
} from '@/types/crmTypes';
import { getBrowserTimeZone, safeTimeZone } from '@/utils/calendarTime';
import { dueDateFromInput, dueDateInputValue, dueTimeInputValue } from '@/utils/taskGrouping';

export interface TaskDraft {
  title: string;
  description: string;
  status: TaskStatusEnum;
  priority: PriorityEnum;
  /** `yyyy-MM-dd` in `timezone`. Empty means no deadline. */
  dueDay: string;
  /** `HH:mm` in `timezone`. Ignored when `isAllDay`. */
  dueTime: string;
  /** `yyyy-MM-dd`; optional work-start, always before the deadline. */
  startDay: string;
  isAllDay: boolean;
  assigneeUserId: string;
  reporterUserId: string;
  relatedType: TaskRelatedType;
  relatedId: number | null;
  labels: string[];
  rrule: string;
  reminderOffsetMinutes: number | null;
  timezone: string;
}

const DEFAULT_TIME = '17:00';

export const emptyDraft = (overrides: Partial<TaskDraft> = {}): TaskDraft => ({
  title: '',
  description: '',
  status: TaskStatusEnum.TODO,
  priority: PriorityEnum.MEDIUM,
  dueDay: '',
  dueTime: DEFAULT_TIME,
  startDay: '',
  isAllDay: false,
  assigneeUserId: '',
  reporterUserId: '',
  relatedType: 'NONE',
  relatedId: null,
  labels: [],
  rrule: '',
  reminderOffsetMinutes: null,
  timezone: getBrowserTimeZone(),
  ...overrides,
});

/**
 * Infers the link type for a task served by a backend that predates
 * `related_type`: an old task with a `lead` is a LEAD task, anything else is
 * unlinked.
 */
export const resolveRelatedType = (task: Pick<Task, 'related_type' | 'lead'>): TaskRelatedType => {
  if (task.related_type) return task.related_type;
  return task.lead ? 'LEAD' : 'NONE';
};

export const resolveRelatedId = (task: Pick<Task, 'related_type' | 'related_id' | 'lead'>):
  | number
  | null => {
  if (task.related_type) return task.related_id ?? null;
  return task.lead ?? null;
};

export const draftFromTask = (task: Task, viewerTimeZone?: string): TaskDraft => {
  const tz = safeTimeZone(task.timezone || viewerTimeZone || getBrowserTimeZone());
  return {
    title: task.title || '',
    description: task.description || '',
    status: task.status || TaskStatusEnum.TODO,
    priority: task.priority || PriorityEnum.MEDIUM,
    dueDay: dueDateInputValue(task, tz),
    dueTime: task.due_date ? dueTimeInputValue(task, tz) : DEFAULT_TIME,
    startDay: task.start_date ? dueDateInputValue({ ...task, due_date: task.start_date }, tz) : '',
    isAllDay: Boolean(task.is_all_day),
    assigneeUserId: task.assignee_user_id || '',
    reporterUserId: task.reporter_user_id || '',
    relatedType: resolveRelatedType(task),
    relatedId: resolveRelatedId(task),
    labels: Array.isArray(task.labels) ? task.labels : [],
    rrule: task.rrule || '',
    reminderOffsetMinutes: task.reminder_offset_minutes ?? null,
    timezone: tz,
  };
};

/**
 * Builds the API payload.
 *
 * `lead` is still populated for a LEAD-linked task so the existing lead-scoped
 * endpoints and every serializer that predates `related_type` keep working.
 */
export const draftToPayload = (draft: TaskDraft): CreateTaskPayload & UpdateTaskPayload => {
  const tz = safeTimeZone(draft.timezone);
  const dueTime = draft.isAllDay ? '00:00' : draft.dueTime || DEFAULT_TIME;

  const payload: CreateTaskPayload & UpdateTaskPayload = {
    title: draft.title.trim(),
    description: draft.description.trim() || undefined,
    status: draft.status,
    priority: draft.priority,
    due_date: draft.dueDay ? dueDateFromInput(draft.dueDay, dueTime, tz) ?? undefined : undefined,
    assignee_user_id: draft.assigneeUserId || undefined,
    reporter_user_id: draft.reporterUserId || undefined,
    related_type: draft.relatedType,
    related_id: draft.relatedType === 'NONE' ? null : draft.relatedId,
    start_date: draft.startDay ? dueDateFromInput(draft.startDay, '09:00', tz) : null,
    is_all_day: draft.isAllDay,
    timezone: tz,
    rrule: draft.rrule || null,
    labels: draft.labels,
    reminder_offset_minutes: draft.reminderOffsetMinutes,
  };

  if (draft.relatedType === 'LEAD' && draft.relatedId) {
    payload.lead = draft.relatedId;
  }

  return payload;
};

/** Returns a human-readable reason the draft cannot be saved, or null. */
export const validateDraft = (draft: TaskDraft): string | null => {
  if (!draft.title.trim()) return 'Task title is required';
  if (draft.relatedType !== 'NONE' && !draft.relatedId) {
    return 'Pick the record this task is linked to, or set the link to "No link"';
  }
  if (draft.startDay && draft.dueDay && draft.startDay > draft.dueDay) {
    return 'Start date cannot be after the due date';
  }
  return null;
};

/** Common reminder offsets, in minutes before the deadline. */
export const REMINDER_OFFSET_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'No reminder' },
  { value: 0, label: 'At the deadline' },
  { value: 15, label: '15 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 60 * 24, label: '1 day before' },
  { value: 60 * 24 * 7, label: '1 week before' },
];
