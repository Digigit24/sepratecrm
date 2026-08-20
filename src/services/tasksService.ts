// src/services/tasksService.ts
//
// The task-manager endpoints that are being built on the Django side in
// parallel with this UI.
//
// WHY THIS FILE EXISTS SEPARATELY FROM crmService.ts
// -------------------------------------------------
// `crmService` swallows the HTTP status: every method ends in
// `throw new Error(message)`, so `error.response.status` is gone by the time a
// caller sees it. That is fine for endpoints that exist, but useless here --
// this whole module has to tell "the backend has not shipped this route yet"
// (404/501/502/503) apart from "the request genuinely failed".
//
// So requests here throw a `TasksApiError` that keeps `status`, exactly like
// `TelephonyApiError` / `ComposioApiError` do, and `isTasksEndpointUnavailable`
// is the predicate the UI uses to degrade calmly instead of showing a red
// crash toast. See `useTaskManager` for the fallback path: when these routes
// are missing we fetch the plain `/tasks/` list and group it client-side, so
// the page stays useful before the backend lands.

import { AxiosError } from 'axios';
import { crmClient } from '@/lib/client';
import { API_CONFIG, buildQueryString } from '@/lib/apiConfig';
import type {
  Task,
  TasksResponse,
  TasksQueryParams,
  TaskChecklistItem,
  UpdateTaskPayload,
} from '@/types/crmTypes';

/** An error that, unlike everything crmService throws, still knows its status. */
export class TasksApiError extends Error {
  readonly status?: number;
  readonly data?: unknown;

  constructor(error: unknown, fallback = 'Task request failed') {
    const axiosError = error as AxiosError<Record<string, unknown>>;
    const status = axiosError?.response?.status;
    const data = axiosError?.response?.data;

    const backendError =
      (data && typeof data === 'object' && typeof data.error === 'string' && data.error) ||
      (data && typeof data === 'object' && typeof data.detail === 'string' && data.detail) ||
      undefined;

    super(backendError || axiosError?.message || fallback);
    this.name = 'TasksApiError';
    this.status = status;
    this.data = data;
  }
}

const wrap = (error: unknown, fallback: string): never => {
  throw new TasksApiError(error, fallback);
};

/**
 * "This endpoint is not deployed on this backend yet."
 *
 * Mirrors `isTelephonyEndpointUnavailable` / `isComposioUnavailable`. A 404 /
 * 501 / 502 / 503 from one of the new task routes must render as a calm inline
 * notice and fall back to client-side behaviour -- never a white screen, never
 * a red crash toast.
 */
export const isTasksEndpointUnavailable = (error: unknown): boolean => {
  const status =
    error instanceof TasksApiError
      ? error.status
      : (error as AxiosError)?.response?.status;
  return status === 404 || status === 501 || status === 502 || status === 503;
};

/** SWR must not retry a route the server does not have -- a stable state. */
export const taskReadSwrOptions = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  shouldRetryOnError: (err: unknown) => !isTasksEndpointUnavailable(err),
} as const;

const withId = (template: string, id: number) => template.replace(':id', String(id));

// ---------------------------------------------------------------------------
// my-day: the server-side grouping
// ---------------------------------------------------------------------------

export interface MyDayResponse {
  overdue: Task[];
  today: Task[];
  this_week: Task[];
  later: Task[];
  done_today: Task[];
}

export const getMyDay = async (params?: TasksQueryParams): Promise<MyDayResponse> => {
  try {
    const qs = buildQueryString(params);
    const response = await crmClient.get<MyDayResponse>(
      `${API_CONFIG.CRM.TASK_MY_DAY}${qs}`,
      // A 404 here is an expected, non-fatal condition; do not let the global
      // interceptor toast about it.
      { suppressErrorToast: true }
    );
    return response.data;
  } catch (error) {
    return wrap(error, 'Failed to load your day');
  }
};

// ---------------------------------------------------------------------------
// bulk / complete / reorder
// ---------------------------------------------------------------------------

export interface BulkPatchResponse {
  updated: number;
}

export const bulkPatchTasks = async (
  ids: number[],
  patch: Partial<UpdateTaskPayload>
): Promise<BulkPatchResponse> => {
  try {
    const response = await crmClient.patch<BulkPatchResponse>(
      API_CONFIG.CRM.TASK_BULK,
      { ids, patch },
      { suppressErrorToast: true }
    );
    return response.data;
  } catch (error) {
    return wrap(error, 'Failed to update tasks');
  }
};

/**
 * Toggles DONE server-side, spawning the next occurrence when the task repeats.
 * Callers must be ready for `isTasksEndpointUnavailable` and fall back to a
 * plain PATCH of `status`.
 */
export const completeTask = async (id: number): Promise<Task> => {
  try {
    const response = await crmClient.post<Task>(
      withId(API_CONFIG.CRM.TASK_COMPLETE, id),
      {},
      { suppressErrorToast: true }
    );
    return response.data;
  } catch (error) {
    return wrap(error, 'Failed to complete task');
  }
};

export const reorderTasks = async (ids: number[]): Promise<void> => {
  try {
    await crmClient.post(API_CONFIG.CRM.TASK_REORDER, { ids }, { suppressErrorToast: true });
  } catch (error) {
    wrap(error, 'Failed to reorder tasks');
  }
};

// ---------------------------------------------------------------------------
// checklist
// ---------------------------------------------------------------------------

export const getChecklist = async (taskId: number): Promise<TaskChecklistItem[]> => {
  try {
    const response = await crmClient.get<TaskChecklistItem[] | { results: TaskChecklistItem[] }>(
      withId(API_CONFIG.CRM.TASK_CHECKLIST, taskId),
      { suppressErrorToast: true }
    );
    const data = response.data;
    return Array.isArray(data) ? data : data?.results ?? [];
  } catch (error) {
    return wrap(error, 'Failed to load checklist');
  }
};

export const addChecklistItem = async (
  taskId: number,
  title: string
): Promise<TaskChecklistItem> => {
  try {
    const response = await crmClient.post<TaskChecklistItem>(
      withId(API_CONFIG.CRM.TASK_CHECKLIST, taskId),
      { title },
      { suppressErrorToast: true }
    );
    return response.data;
  } catch (error) {
    return wrap(error, 'Failed to add checklist item');
  }
};

export const updateChecklistItem = async (
  taskId: number,
  itemId: number,
  patch: Partial<Pick<TaskChecklistItem, 'title' | 'is_done' | 'order_index'>>
): Promise<TaskChecklistItem> => {
  try {
    const response = await crmClient.patch<TaskChecklistItem>(
      withId(API_CONFIG.CRM.TASK_CHECKLIST_ITEM, taskId).replace(':itemId', String(itemId)),
      patch,
      { suppressErrorToast: true }
    );
    return response.data;
  } catch (error) {
    return wrap(error, 'Failed to update checklist item');
  }
};

export const deleteChecklistItem = async (taskId: number, itemId: number): Promise<void> => {
  try {
    await crmClient.delete(
      withId(API_CONFIG.CRM.TASK_CHECKLIST_ITEM, taskId).replace(':itemId', String(itemId)),
      { suppressErrorToast: true }
    );
  } catch (error) {
    wrap(error, 'Failed to delete checklist item');
  }
};

// ---------------------------------------------------------------------------
// plain list -- the always-available fallback
// ---------------------------------------------------------------------------

/**
 * The one read every backend supports. Used as the degradation path when
 * `my-day/` is missing, and as the single source for Board and Calendar.
 */
export const listTasks = async (params?: TasksQueryParams): Promise<TasksResponse> => {
  try {
    const qs = buildQueryString(params);
    const response = await crmClient.get<TasksResponse>(`${API_CONFIG.CRM.TASKS}${qs}`);
    return response.data;
  } catch (error) {
    return wrap(error, 'Failed to fetch tasks');
  }
};

export const tasksService = {
  getMyDay,
  bulkPatchTasks,
  completeTask,
  reorderTasks,
  getChecklist,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  listTasks,
};

export default tasksService;
