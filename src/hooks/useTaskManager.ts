// src/hooks/useTaskManager.ts
//
// Data orchestration for the one-page task manager.
//
// DEGRADATION IS THE POINT OF THIS FILE
// -------------------------------------
// `/tasks/my-day/`, `/tasks/{id}/complete/`, `/tasks/reorder/` and
// `/tasks/bulk/` are being built on the Django side in parallel with this UI.
// Every one of them may answer 404/501/502/503 today. So:
//
//   * my-day  -> fall back to the plain `/tasks/` list + client-side grouping
//                (taskGrouping.ts). The page is fully usable either way; the
//                only visible difference is a calm inline notice.
//   * complete-> fall back to a plain PATCH of `status`.
//   * reorder -> keep the optimistic local order, skip persistence, and say so
//                once rather than toasting on every drag.
//
// The fallback is decided ONCE per session per endpoint and remembered, so a
// backend without these routes costs exactly one failed request each, not one
// per interaction.

import { useCallback, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useCRM } from '@/hooks/useCRM';
import {
  isTasksEndpointUnavailable,
  taskReadSwrOptions,
  tasksService,
  type MyDayResponse,
} from '@/services/tasksService';
import {
  TASK_BUCKET_IDS,
  bucketForTask,
  compareWithinBucket,
  dueDateForBucket,
  groupTasks,
  groupsFromMyDay,
  isTaskDone,
  type GroupedTasks,
  type TaskBucketId,
} from '@/utils/taskGrouping';
import { getBrowserTimeZone } from '@/utils/calendarTime';
import { filterTasks, type TaskFilters, type TaskViewMode } from '@/components/tasks/taskFilters';
import { TaskStatusEnum, type Task, type TasksQueryParams, type UpdateTaskPayload } from '@/types/crmTypes';

/** Board and Calendar need every task at once, not a page of them. */
const FLAT_PAGE_SIZE = 500;

export interface TaskManager {
  groups: GroupedTasks;
  /** Flat, filtered list -- what Board and Calendar render. */
  tasks: Task[];
  /** Flat, UNfiltered list -- what the label chip menu is built from. */
  allTasks: Task[];
  isLoading: boolean;
  error: unknown;
  /** The my-day endpoint is not deployed; grouping happened client-side. */
  usingClientGrouping: boolean;
  /** Reordering cannot be persisted on this backend. */
  reorderUnavailable: boolean;
  timeZone: string;
  refresh: () => void;
  toggleComplete: (task: Task) => Promise<void>;
  patchTask: (id: number, patch: Partial<UpdateTaskPayload>) => Promise<void>;
  moveToBucket: (task: Task, bucket: TaskBucketId) => Promise<void>;
  reorderWithin: (bucket: TaskBucketId, orderedIds: number[]) => Promise<void>;
}

/**
 * Moves a task between groups locally, so the checkbox and drag feel instant.
 * Pure, so the optimistic behaviour can be asserted without a render.
 */
export const applyLocalMove = (
  groups: GroupedTasks,
  taskId: number,
  patch: Partial<Task>,
  timeZone: string
): GroupedTasks => {
  let moved: Task | undefined;
  const stripped: GroupedTasks = {
    overdue: [],
    today: [],
    this_week: [],
    later: [],
    done: [],
  };

  for (const id of TASK_BUCKET_IDS) {
    for (const t of groups[id]) {
      if (t.id === taskId) moved = { ...t, ...patch };
      else stripped[id].push(t);
    }
  }

  if (!moved) return groups;

  stripped[bucketForTask(moved, { timeZone })].push(moved);
  for (const id of TASK_BUCKET_IDS) stripped[id].sort(compareWithinBucket);
  return stripped;
};

export const flattenGroups = (groups: GroupedTasks): Task[] =>
  TASK_BUCKET_IDS.flatMap((id) => groups[id]);

export const useTaskManager = (
  view: TaskViewMode,
  filters: TaskFilters,
  queryParams?: TasksQueryParams
): TaskManager => {
  const { user } = useAuth();
  const { patchTask: crmPatchTask } = useCRM();

  const timeZone = useMemo(() => getBrowserTimeZone(), []);

  // Remembered, per-session, so a missing route costs one request not N.
  const [myDayUnavailable, setMyDayUnavailable] = useState(false);
  const [reorderUnavailable, setReorderUnavailable] = useState(false);
  const completeUnavailable = useRef(false);
  const warnedAboutReorder = useRef(false);

  // Only the List view can use the server's grouping.
  const wantMyDay = view === 'list' && !myDayUnavailable;

  const myDay = useSWR<MyDayResponse>(
    wantMyDay ? ['tasks', 'my-day', queryParams] : null,
    () => tasksService.getMyDay(queryParams),
    {
      ...taskReadSwrOptions,
      onError: (err) => {
        if (isTasksEndpointUnavailable(err)) setMyDayUnavailable(true);
      },
    }
  );

  // The always-available path: used by Board/Calendar, and by List once we know
  // my-day is not there.
  const wantFlatList = !wantMyDay || Boolean(myDay.error);

  const flat = useSWR(
    wantFlatList
      ? ['tasks', 'list', { ...queryParams, page_size: queryParams?.page_size ?? FLAT_PAGE_SIZE }]
      : null,
    () =>
      tasksService.listTasks({
        ...queryParams,
        page_size: queryParams?.page_size ?? FLAT_PAGE_SIZE,
      }),
    taskReadSwrOptions
  );

  const usingClientGrouping = !wantMyDay || Boolean(myDay.error);

  // ---- assemble ----------------------------------------------------------
  const serverGroups = useMemo<GroupedTasks>(() => {
    if (!usingClientGrouping && myDay.data) return groupsFromMyDay(myDay.data);
    return groupTasks(flat.data?.results ?? [], { timeZone });
  }, [usingClientGrouping, myDay.data, flat.data, timeZone]);

  // Optimistic overlay. Mutations write here first; a successful revalidation
  // replaces it. Keyed by identity so a refetch naturally clears it.
  const [overlay, setOverlay] = useState<GroupedTasks | null>(null);
  const overlayBase = useRef<GroupedTasks | null>(null);

  const groupsBeforeFilter = overlay ?? serverGroups;

  const allTasks = useMemo(() => flattenGroups(groupsBeforeFilter), [groupsBeforeFilter]);

  const groups = useMemo<GroupedTasks>(() => {
    const out: GroupedTasks = { overdue: [], today: [], this_week: [], later: [], done: [] };
    for (const id of TASK_BUCKET_IDS) {
      out[id] = filterTasks(groupsBeforeFilter[id], filters, user?.id);
    }
    return out;
  }, [groupsBeforeFilter, filters, user?.id]);

  const tasks = useMemo(() => flattenGroups(groups), [groups]);

  const refresh = useCallback(() => {
    setOverlay(null);
    overlayBase.current = null;
    myDay.mutate();
    flat.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myDay.mutate, flat.mutate]);

  /** Applies an optimistic patch and returns a rollback function. */
  const optimistically = useCallback(
    (taskId: number, patch: Partial<Task>) => {
      const before = overlay ?? serverGroups;
      overlayBase.current = before;
      setOverlay(applyLocalMove(before, taskId, patch, timeZone));
      return () => setOverlay(before);
    },
    [overlay, serverGroups, timeZone]
  );

  const settle = useCallback(() => {
    setOverlay(null);
    overlayBase.current = null;
    myDay.mutate();
    flat.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myDay.mutate, flat.mutate]);

  // ---- mutations ---------------------------------------------------------

  const toggleComplete = useCallback(
    async (task: Task) => {
      const nextDone = !isTaskDone(task);
      const rollback = optimistically(task.id, {
        status: nextDone ? TaskStatusEnum.DONE : TaskStatusEnum.TODO,
        completed_at: nextDone ? new Date().toISOString() : undefined,
      });

      try {
        if (!completeUnavailable.current) {
          try {
            await tasksService.completeTask(task.id);
            settle();
            return;
          } catch (err) {
            if (!isTasksEndpointUnavailable(err)) throw err;
            // Route not deployed: remember, then fall through to the PATCH.
            completeUnavailable.current = true;
          }
        }

        await crmPatchTask(task.id, {
          status: nextDone ? TaskStatusEnum.DONE : TaskStatusEnum.TODO,
        });
        settle();
      } catch (err) {
        rollback();
        toast.error(err instanceof Error ? err.message : 'Could not update that task');
      }
    },
    [optimistically, settle, crmPatchTask]
  );

  const patchTask = useCallback(
    async (id: number, patch: Partial<UpdateTaskPayload>) => {
      const rollback = optimistically(id, patch as Partial<Task>);
      try {
        await crmPatchTask(id, patch);
        settle();
      } catch (err) {
        rollback();
        toast.error(err instanceof Error ? err.message : 'Could not update that task');
      }
    },
    [optimistically, settle, crmPatchTask]
  );

  const moveToBucket = useCallback(
    async (task: Task, bucket: TaskBucketId) => {
      if (bucket === 'done') {
        if (!isTaskDone(task)) await toggleComplete(task);
        return;
      }

      // Dragging a completed task back out of Done reopens it.
      if (isTaskDone(task)) {
        await patchTask(task.id, { status: TaskStatusEnum.TODO });
      }

      const nextDue = dueDateForBucket(bucket, task, { timeZone });
      if (nextDue === undefined) return;
      await patchTask(task.id, { due_date: nextDue ?? undefined });
    },
    [toggleComplete, patchTask, timeZone]
  );

  const reorderWithin = useCallback(
    async (bucket: TaskBucketId, orderedIds: number[]) => {
      // Optimistic: rewrite order_index locally so the row stays where dropped.
      const before = overlay ?? serverGroups;
      const indexById = new Map(orderedIds.map((id, i) => [id, i]));
      const next: GroupedTasks = { ...before };
      next[bucket] = [...before[bucket]]
        .map((t) => (indexById.has(t.id) ? { ...t, order_index: indexById.get(t.id) } : t))
        .sort(compareWithinBucket);
      setOverlay(next);

      if (reorderUnavailable) return;

      try {
        await tasksService.reorderTasks(orderedIds);
      } catch (err) {
        if (isTasksEndpointUnavailable(err)) {
          setReorderUnavailable(true);
          if (!warnedAboutReorder.current) {
            warnedAboutReorder.current = true;
            toast.info('Custom ordering is not saved on this server yet.');
          }
          return; // keep the optimistic order; it is still useful this session
        }
        setOverlay(before);
        toast.error(err instanceof Error ? err.message : 'Could not reorder those tasks');
      }
    },
    [overlay, serverGroups, reorderUnavailable]
  );

  const isLoading = wantMyDay ? myDay.isLoading : flat.isLoading;
  // A missing my-day route is not an error the user should see.
  const error = usingClientGrouping ? flat.error : myDay.error;

  return {
    groups,
    tasks,
    allTasks,
    isLoading,
    error,
    usingClientGrouping,
    reorderUnavailable,
    timeZone,
    refresh,
    toggleComplete,
    patchTask,
    moveToBucket,
    reorderWithin,
  };
};

export default useTaskManager;
