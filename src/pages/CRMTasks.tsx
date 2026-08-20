// src/pages/CRMTasks.tsx
//
// The task manager: ONE page, Notion-style.
//
// LAYOUT
// ------
//   [ header: title, counts, view switch, new task ]
//   [ filter chips                                 ]
//   [ list / board / calendar        | side panel  ]   <- flex row
//
// The side panel is a flex SIBLING of the list, not an overlay, so the list
// stays visible and usable while a task is open -- tick a checkbox, drag a row,
// or click straight through to the next task without a modal closing first.
// That is the entire point of the layout.
//
// URL IS THE STATE
// ----------------
// View, filters and the open task all live in the query string
// (`?view=board&assignee=me&task=42`). So a filtered view is a shareable link,
// and the browser Back button closes the panel instead of leaving the page.

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CalendarDays,
  Info,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { useTaskManager } from '@/hooks/useTaskManager';
import { TaskKanbanBoard } from '@/components/TaskKanbanBoard';
import TaskFormDrawer from '@/components/TaskFormDrawer';
import { TaskListView } from '@/components/tasks/TaskListView';
import { TaskSidePanel } from '@/components/tasks/TaskSidePanel';
import { TaskFilterBar } from '@/components/tasks/TaskFilterBar';
import { TaskCalendarView } from '@/components/tasks/TaskCalendarView';
import {
  collectLabels,
  parseSelectedTaskId,
  parseTaskFilters,
  parseViewMode,
  writeTaskParams,
  type TaskFilters,
  type TaskViewMode,
} from '@/components/tasks/taskFilters';
import { TASK_BUCKETS, type TaskBucketId } from '@/utils/taskGrouping';
import type { Task, TaskStatusEnum } from '@/types/crmTypes';

export const CRMTasks: React.FC = () => {
  const { hasCRMAccess } = useCRM();
  const [searchParams, setSearchParams] = useSearchParams();

  // ---- URL-derived state -------------------------------------------------
  const view = parseViewMode(searchParams);
  const selectedTaskId = parseSelectedTaskId(searchParams);
  const filters = useMemo(() => parseTaskFilters(searchParams), [searchParams]);

  const updateParams = useCallback(
    (
      next: Parameters<typeof writeTaskParams>[1],
      options?: { replace?: boolean }
    ) => {
      setSearchParams((prev) => writeTaskParams(prev, next), {
        replace: options?.replace ?? false,
      });
    },
    [setSearchParams]
  );

  const setView = useCallback(
    (nextView: TaskViewMode) => updateParams({ view: nextView }, { replace: true }),
    [updateParams]
  );

  const setFilters = useCallback(
    (nextFilters: TaskFilters) => updateParams({ filters: nextFilters }, { replace: true }),
    [updateParams]
  );

  // A push (not replace) so Back closes the panel rather than leaving the page.
  const openTask = useCallback(
    (task: Task) => updateParams({ selectedTaskId: task.id }),
    [updateParams]
  );

  const closePanel = useCallback(
    () => updateParams({ selectedTaskId: null }),
    [updateParams]
  );

  // ---- data --------------------------------------------------------------
  const manager = useTaskManager(view, filters);
  const {
    groups,
    tasks,
    allTasks,
    isLoading,
    error,
    usingClientGrouping,
    timeZone,
    refresh,
    toggleComplete,
    patchTask,
    moveToBucket,
    reorderWithin,
  } = manager;

  const labels = useMemo(() => collectLabels(allTasks), [allTasks]);

  const counts = useMemo(
    () => ({
      open: TASK_BUCKETS.filter((b) => b.id !== 'done').reduce(
        (n, b) => n + groups[b.id].length,
        0
      ),
      overdue: groups.overdue.length,
    }),
    [groups]
  );

  // ---- create drawer -----------------------------------------------------
  const [createOpen, setCreateOpen] = useState(false);

  const handleCreateInGroup = useCallback((_bucket: TaskBucketId) => {
    setCreateOpen(true);
  }, []);

  // The board still speaks status, not buckets.
  const handleBoardStatusChange = useCallback(
    async (taskId: number, status: TaskStatusEnum) => {
      await patchTask(taskId, { status });
    },
    [patchTask]
  );

  if (!hasCRMAccess) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="mb-2 text-xl font-semibold">CRM Access Required</h2>
            <p className="text-gray-600">
              CRM module is not enabled for your account. Please contact your administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* ---- header ---- */}
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <h1 className="text-base font-semibold">Tasks</h1>
        <span className="text-xs text-muted-foreground">
          {counts.open} open
          {counts.overdue > 0 && (
            <span className="ml-1 font-medium text-red-600 dark:text-red-400">
              · {counts.overdue} overdue
            </span>
          )}
        </span>

        <div className="flex-1" />

        <Tabs value={view} onValueChange={(v) => setView(v as TaskViewMode)}>
          <TabsList className="h-7">
            <TabsTrigger value="list" className="h-5 gap-1.5 px-2 text-xs">
              <List className="h-3.5 w-3.5" />
              List
            </TabsTrigger>
            <TabsTrigger value="board" className="h-5 gap-1.5 px-2 text-xs">
              <LayoutGrid className="h-3.5 w-3.5" />
              Board
            </TabsTrigger>
            <TabsTrigger value="calendar" className="h-5 gap-1.5 px-2 text-xs">
              <CalendarDays className="h-3.5 w-3.5" />
              Calendar
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={refresh}
          disabled={isLoading}
          title="Refresh"
          aria-label="Refresh tasks"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>

        <Button size="sm" className="h-7 text-xs" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          New task
        </Button>
      </div>

      {/* ---- filters ---- */}
      <div className="border-b px-3 py-1.5">
        <TaskFilterBar filters={filters} onChange={setFilters} labels={labels} />
      </div>

      {/* ---- body: content + persistent side panel ---- */}
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto">
          {error ? (
            <div className="m-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="text-sm">
                <p className="font-medium">Could not load tasks</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {error instanceof Error ? error.message : String(error)}
                </p>
                <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={refresh}>
                  Try again
                </Button>
              </div>
            </div>
          ) : (
            <>
              {view === 'list' && usingClientGrouping && (
                <div
                  data-testid="task-grouping-degraded"
                  className="mx-3 mt-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
                >
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p className="text-xs">
                    This server does not group tasks yet, so the grouping below is worked
                    out in your browser. Everything still works.
                  </p>
                </div>
              )}

              {view === 'list' && (
                <TaskListView
                  groups={groups}
                  isLoading={isLoading}
                  selectedTaskId={selectedTaskId}
                  timeZone={timeZone}
                  onOpenTask={openTask}
                  onToggleComplete={toggleComplete}
                  onPatchTask={patchTask}
                  onMoveToBucket={moveToBucket}
                  onReorderWithin={reorderWithin}
                  onCreateInGroup={handleCreateInGroup}
                />
              )}

              {view === 'board' && (
                <div className="p-3">
                  <TaskKanbanBoard
                    tasks={tasks}
                    onViewTask={openTask}
                    onEditTask={openTask}
                    onCreateTask={() => setCreateOpen(true)}
                    onUpdateTaskStatus={handleBoardStatusChange}
                    isLoading={isLoading}
                  />
                </div>
              )}

              {view === 'calendar' && (
                <TaskCalendarView
                  tasks={tasks}
                  timeZone={timeZone}
                  onOpenTask={openTask}
                  onCreateOnDay={() => setCreateOpen(true)}
                />
              )}
            </>
          )}
        </div>

        {selectedTaskId && (
          <TaskSidePanel
            key={selectedTaskId}
            taskId={selectedTaskId}
            onClose={closePanel}
            onSaved={refresh}
            onDeleted={() => {
              closePanel();
              refresh();
            }}
            onPatch={patchTask}
          />
        )}
      </div>

      <TaskFormDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        taskId={null}
        mode="create"
        onSuccess={refresh}
      />
    </div>
  );
};