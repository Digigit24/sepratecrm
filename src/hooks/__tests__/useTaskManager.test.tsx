import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import React from 'react';

import { applyLocalMove, useTaskManager } from '@/hooks/useTaskManager';
import { TasksApiError } from '@/services/tasksService';
import { EMPTY_FILTERS } from '@/components/tasks/taskFilters';
import { PriorityEnum, TaskStatusEnum, type Task } from '@/types/crmTypes';

// ---- mocks ---------------------------------------------------------------

const patchTaskMock = vi.fn();
const toastError = vi.fn();
const toastInfo = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({ patchTask: patchTaskMock }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    info: (...args: unknown[]) => toastInfo(...args),
    success: vi.fn(),
  },
}));

const getMyDay = vi.fn();
const listTasks = vi.fn();
const completeTask = vi.fn();
const reorderTasks = vi.fn();

vi.mock('@/services/tasksService', async () => {
  const actual = await vi.importActual<typeof import('@/services/tasksService')>(
    '@/services/tasksService'
  );
  return {
    ...actual,
    tasksService: {
      getMyDay: (...a: unknown[]) => getMyDay(...a),
      listTasks: (...a: unknown[]) => listTasks(...a),
      completeTask: (...a: unknown[]) => completeTask(...a),
      reorderTasks: (...a: unknown[]) => reorderTasks(...a),
    },
  };
});

// ---- fixtures ------------------------------------------------------------

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 1,
  tenant_id: 't1',
  title: 'Call the architect',
  status: TaskStatusEnum.TODO,
  priority: PriorityEnum.MEDIUM,
  attachments_count: 0,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  ...overrides,
});

/** A 404 from a route the backend has not deployed yet. */
const notDeployed = () =>
  new TasksApiError({ response: { status: 404, data: {} }, message: 'Not Found' });

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(
    SWRConfig,
    { value: { provider: () => new Map(), dedupingInterval: 0 } },
    children
  );

const renderManager = () =>
  renderHook(() => useTaskManager('list', EMPTY_FILTERS), { wrapper });

beforeEach(() => {
  vi.clearAllMocks();
  getMyDay.mockReset();
  listTasks.mockReset();
  completeTask.mockReset();
  reorderTasks.mockReset();
  patchTaskMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ==========================================================================

describe('applyLocalMove (the optimistic engine)', () => {
  const groups = {
    overdue: [],
    today: [task({ id: 1 })],
    this_week: [],
    later: [],
    done: [],
  };

  it('moves a completed task out of its bucket and into Done', () => {
    const next = applyLocalMove(groups, 1, { status: TaskStatusEnum.DONE }, 'Asia/Kolkata');
    expect(next.today).toHaveLength(0);
    expect(next.done.map((t) => t.id)).toEqual([1]);
  });

  it('leaves the original object untouched so rollback can restore it', () => {
    applyLocalMove(groups, 1, { status: TaskStatusEnum.DONE }, 'Asia/Kolkata');
    expect(groups.today).toHaveLength(1);
    expect(groups.today[0].status).toBe(TaskStatusEnum.TODO);
  });

  it('is a no-op for an unknown id', () => {
    expect(applyLocalMove(groups, 999, { status: TaskStatusEnum.DONE }, 'UTC')).toBe(groups);
  });
});

describe('graceful degradation when the new endpoints are missing', () => {
  it('falls back to the plain list + client grouping when my-day 404s', async () => {
    getMyDay.mockRejectedValue(notDeployed());
    listTasks.mockResolvedValue({ count: 1, next: null, previous: null, results: [task()] });

    const { result } = renderManager();

    await waitFor(() => expect(result.current.usingClientGrouping).toBe(true));
    await waitFor(() => expect(result.current.allTasks).toHaveLength(1));

    // The page is fully usable, and this is NOT surfaced as an error.
    expect(result.current.error).toBeFalsy();
    expect(listTasks).toHaveBeenCalled();
  });

  it('does not hammer a missing my-day route on re-render', async () => {
    getMyDay.mockRejectedValue(notDeployed());
    listTasks.mockResolvedValue({ count: 0, next: null, previous: null, results: [] });

    const { result, rerender } = renderManager();
    await waitFor(() => expect(result.current.usingClientGrouping).toBe(true));

    const callsAfterFirst = getMyDay.mock.calls.length;
    rerender();
    rerender();

    expect(getMyDay.mock.calls.length).toBe(callsAfterFirst);
  });

  it('uses the server grouping when my-day IS available', async () => {
    getMyDay.mockResolvedValue({
      overdue: [task({ id: 7 })],
      today: [],
      this_week: [],
      later: [],
      done_today: [task({ id: 8, status: TaskStatusEnum.DONE })],
    });

    const { result } = renderManager();

    await waitFor(() => expect(result.current.groups.overdue).toHaveLength(1));
    expect(result.current.usingClientGrouping).toBe(false);
    expect(result.current.groups.done.map((t) => t.id)).toEqual([8]);
    expect(listTasks).not.toHaveBeenCalled();
  });

  it('falls back to a plain PATCH when the complete/ route is missing', async () => {
    getMyDay.mockResolvedValue({
      overdue: [],
      today: [task({ id: 1 })],
      this_week: [],
      later: [],
      done_today: [],
    });
    completeTask.mockRejectedValue(notDeployed());
    patchTaskMock.mockResolvedValue(task({ id: 1, status: TaskStatusEnum.DONE }));

    const { result } = renderManager();
    await waitFor(() => expect(result.current.groups.today).toHaveLength(1));

    await act(async () => {
      await result.current.toggleComplete(result.current.groups.today[0]);
    });

    expect(completeTask).toHaveBeenCalledWith(1);
    expect(patchTaskMock).toHaveBeenCalledWith(1, { status: TaskStatusEnum.DONE });
    // A missing route is not the user's problem.
    expect(toastError).not.toHaveBeenCalled();
  });

  it('keeps the local order and warns once when reorder/ is missing', async () => {
    getMyDay.mockResolvedValue({
      overdue: [],
      today: [task({ id: 1 }), task({ id: 2 })],
      this_week: [],
      later: [],
      done_today: [],
    });
    reorderTasks.mockRejectedValue(notDeployed());

    const { result } = renderManager();
    await waitFor(() => expect(result.current.groups.today).toHaveLength(2));

    await act(async () => {
      await result.current.reorderWithin('today', [2, 1]);
    });

    // Optimistic order survives even though it could not be persisted.
    expect(result.current.groups.today.map((t) => t.id)).toEqual([2, 1]);
    expect(result.current.reorderUnavailable).toBe(true);
    expect(toastInfo).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();

    // A second reorder must not re-warn, and must not retry the dead route.
    reorderTasks.mockClear();
    await act(async () => {
      await result.current.reorderWithin('today', [1, 2]);
    });
    expect(reorderTasks).not.toHaveBeenCalled();
    expect(toastInfo).toHaveBeenCalledTimes(1);
  });
});

describe('optimistic complete, and rollback when the write fails', () => {
  const setup = async () => {
    getMyDay.mockResolvedValue({
      overdue: [],
      today: [task({ id: 1, title: 'Call the architect' })],
      this_week: [],
      later: [],
      done_today: [],
    });
    const rendered = renderManager();
    await waitFor(() => expect(rendered.result.current.groups.today).toHaveLength(1));
    return rendered;
  };

  it('moves the task to Done immediately on success', async () => {
    completeTask.mockResolvedValue(task({ id: 1, status: TaskStatusEnum.DONE }));
    const { result } = await setup();

    await act(async () => {
      await result.current.toggleComplete(result.current.groups.today[0]);
    });

    expect(completeTask).toHaveBeenCalledWith(1);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('ROLLS BACK to the original bucket when the server rejects it', async () => {
    // A real failure (500), not a missing route.
    completeTask.mockRejectedValue(
      new TasksApiError({ response: { status: 500, data: { error: 'boom' } } })
    );
    const { result } = await setup();

    expect(result.current.groups.today.map((t) => t.id)).toEqual([1]);
    expect(result.current.groups.done).toHaveLength(0);

    await act(async () => {
      await result.current.toggleComplete(result.current.groups.today[0]);
    });

    // The row is back where it started, and still not done.
    expect(result.current.groups.today.map((t) => t.id)).toEqual([1]);
    expect(result.current.groups.today[0].status).toBe(TaskStatusEnum.TODO);
    expect(result.current.groups.done).toHaveLength(0);
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it('rolls an inline field edit back too, and surfaces the reason', async () => {
    patchTaskMock.mockRejectedValue(new Error('Network down'));
    const { result } = await setup();

    await act(async () => {
      await result.current.patchTask(1, { assignee_user_id: 'user-2' });
    });

    expect(result.current.groups.today[0].assignee_user_id).toBeUndefined();
    expect(toastError).toHaveBeenCalledWith('Network down');
  });
});

describe('filtering is applied on top of whichever source supplied the data', () => {
  it('filters the grouped output without refetching', async () => {
    getMyDay.mockResolvedValue({
      overdue: [],
      today: [
        task({ id: 1, priority: PriorityEnum.HIGH }),
        task({ id: 2, priority: PriorityEnum.LOW }),
      ],
      this_week: [],
      later: [],
      done_today: [],
    });

    const { result, rerender } = renderHook(
      ({ filters }) => useTaskManager('list', filters),
      { wrapper, initialProps: { filters: EMPTY_FILTERS } }
    );

    await waitFor(() => expect(result.current.groups.today).toHaveLength(2));

    const calls = getMyDay.mock.calls.length;
    rerender({ filters: { ...EMPTY_FILTERS, priority: PriorityEnum.HIGH } });

    await waitFor(() => expect(result.current.groups.today).toHaveLength(1));
    expect(result.current.groups.today[0].id).toBe(1);
    // allTasks stays unfiltered so the label menu still sees everything.
    expect(result.current.allTasks).toHaveLength(2);
    expect(getMyDay.mock.calls.length).toBe(calls);
  });
});
