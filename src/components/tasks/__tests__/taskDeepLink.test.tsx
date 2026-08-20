import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import React from 'react';

import { CRMTasks } from '@/pages/CRMTasks';
import {
  EMPTY_FILTERS,
  parseSelectedTaskId,
  parseTaskFilters,
  parseViewMode,
  writeTaskParams,
} from '@/components/tasks/taskFilters';
import { PriorityEnum, TaskStatusEnum, type Task } from '@/types/crmTypes';

// ---- fixtures ------------------------------------------------------------

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 42,
  tenant_id: 't1',
  title: 'Call the architect',
  status: TaskStatusEnum.TODO,
  priority: PriorityEnum.MEDIUM,
  attachments_count: 0,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  ...overrides,
});

const TASKS = [task({ id: 42 }), task({ id: 43, title: 'Send the proposal' })];

// ---- mocks ---------------------------------------------------------------

vi.mock('@/hooks/useUserDirectory', () => ({
  useUserDirectory: () => ({
    users: [],
    byId: new Map(),
    getUser: () => undefined,
    getName: () => 'Unassigned',
    getInitials: () => '?',
    isLoading: false,
    isForbidden: false,
    error: undefined,
    refresh: vi.fn(),
  }),
  USER_DIRECTORY_KEY: 'user-directory',
  UNASSIGNED_LABEL: 'Unassigned',
  UNKNOWN_USER_LABEL: 'Unknown user',
}));

const patchTask = vi.fn();

vi.mock('@/hooks/useTaskManager', () => ({
  useTaskManager: () => ({
    groups: {
      overdue: [],
      today: TASKS,
      this_week: [],
      later: [],
      done: [],
    },
    tasks: TASKS,
    allTasks: TASKS,
    isLoading: false,
    error: undefined,
    usingClientGrouping: false,
    reorderUnavailable: false,
    timeZone: 'Asia/Kolkata',
    refresh: vi.fn(),
    toggleComplete: vi.fn(),
    patchTask: (...a: unknown[]) => patchTask(...a),
    moveToBucket: vi.fn(),
    reorderWithin: vi.fn(),
  }),
}));

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    hasCRMAccess: true,
    useTask: (id: number | null) => ({
      data: id ? TASKS.find((t) => t.id === id) ?? null : null,
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    }),
    useLeads: () => ({ data: { results: [] }, isLoading: false }),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    patchTask: vi.fn(),
  }),
}));

vi.mock('@/services/tasksService', async () => {
  const actual = await vi.importActual<typeof import('@/services/tasksService')>(
    '@/services/tasksService'
  );
  return {
    ...actual,
    tasksService: { ...actual.tasksService, getChecklist: vi.fn().mockResolvedValue([]) },
  };
});

// Surfaces the live URL so assertions can read it.
const LocationProbe: React.FC = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
};

const renderAt = (initialEntry: string) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/crm/tasks"
          element={
            <>
              <CRMTasks />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
});

// ==========================================================================

describe('the URL is the state (pure encode/decode)', () => {
  it('round-trips filters, view and selection', () => {
    const filters = {
      assignee: 'user-9',
      priority: PriorityEnum.HIGH,
      label: 'onboarding',
      relatedType: 'PROJECT' as const,
      search: 'roof',
    };
    const params = writeTaskParams(new URLSearchParams(), {
      filters,
      view: 'board',
      selectedTaskId: 42,
    });

    expect(parseTaskFilters(params)).toEqual(filters);
    expect(parseViewMode(params)).toBe('board');
    expect(parseSelectedTaskId(params)).toBe(42);
  });

  it('keeps a default view out of the URL', () => {
    const params = writeTaskParams(new URLSearchParams(), {
      filters: EMPTY_FILTERS,
      view: 'list',
      selectedTaskId: null,
    });
    expect(params.toString()).toBe('');
  });

  it('ignores junk rather than rendering a broken view', () => {
    const params = new URLSearchParams('view=telepathy&priority=URGENT&related=BANANA&task=abc');
    expect(parseViewMode(params)).toBe('list');
    expect(parseTaskFilters(params).priority).toBeNull();
    expect(parseTaskFilters(params).relatedType).toBeNull();
    expect(parseSelectedTaskId(params)).toBeNull();
  });

  it('treats a non-positive task id as no selection', () => {
    expect(parseSelectedTaskId(new URLSearchParams('task=0'))).toBeNull();
    expect(parseSelectedTaskId(new URLSearchParams('task=-3'))).toBeNull();
  });
});

describe('deep link opens the side panel', () => {
  it('renders no panel without ?task', () => {
    renderAt('/crm/tasks');
    expect(screen.queryByTestId('task-side-panel')).not.toBeInTheDocument();
  });

  it('opens the panel for the task named in ?task=', async () => {
    renderAt('/crm/tasks?task=42');

    const panel = await screen.findByTestId('task-side-panel');
    expect(panel).toBeInTheDocument();
    // The panel shows THAT task, not just any task.
    expect(within(panel).getByText('Call the architect')).toBeInTheDocument();
  });

  it('keeps the list mounted and usable while the panel is open', async () => {
    renderAt('/crm/tasks?task=42');
    await screen.findByTestId('task-side-panel');

    // The whole point of the layout: the list is still there.
    expect(screen.getByTestId('task-list')).toBeInTheDocument();
    expect(screen.getAllByTestId('task-row')).toHaveLength(2);
  });

  it('closing the panel clears ?task from the URL', async () => {
    renderAt('/crm/tasks?task=42');
    await screen.findByTestId('task-side-panel');

    fireEvent.click(screen.getByTestId('task-panel-close'));

    await waitFor(() =>
      expect(screen.queryByTestId('task-side-panel')).not.toBeInTheDocument()
    );
    expect(screen.getByTestId('location').textContent).toBe('/crm/tasks');
  });

  it('clicking a row deep-links to it', async () => {
    renderAt('/crm/tasks');

    const rows = screen.getAllByTestId('task-row');
    fireEvent.click(rows[1]);

    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toBe('/crm/tasks?task=43')
    );
    expect(await screen.findByTestId('task-side-panel')).toBeInTheDocument();
  });

  it('a filtered view survives in the URL alongside the open task', async () => {
    renderAt('/crm/tasks?priority=HIGH&task=42');
    await screen.findByTestId('task-side-panel');

    fireEvent.click(screen.getByTestId('task-panel-close'));

    await waitFor(() =>
      // Closing the panel must not throw the filters away.
      expect(screen.getByTestId('location').textContent).toBe('/crm/tasks?priority=HIGH')
    );
  });
});

