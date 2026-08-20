// src/components/tasks/TaskListView.tsx
//
// The grouped list: the primary surface of the task manager.
//
// DRAG SEMANTICS
// --------------
// Dropping inside the same group reorders (persisted via /tasks/reorder/, or
// kept locally when that route is missing). Dropping onto a different group
// re-dates the task into that bucket -- dragging into "Today" sets the deadline
// to today, keeping the existing time of day. "Overdue" is not a drop target:
// you cannot make something late by dragging it there.
//
// @dnd-kit is used here (the Board still uses @hello-pangea/dnd, which it was
// already written against) because the sortable + multi-container combination
// is what @dnd-kit/sortable is actually good at.

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import { arrayMove } from '@dnd-kit/sortable';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckSquare } from 'lucide-react';
import { TASK_BUCKETS, type GroupedTasks, type TaskBucketId } from '@/utils/taskGrouping';
import type { Task, UpdateTaskPayload } from '@/types/crmTypes';
import { TaskGroupSection } from './TaskGroupSection';

export interface TaskListViewProps {
  groups: GroupedTasks;
  isLoading: boolean;
  selectedTaskId: number | null;
  timeZone: string;
  onOpenTask: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  onPatchTask: (id: number, patch: Partial<UpdateTaskPayload>) => void;
  onMoveToBucket: (task: Task, bucket: TaskBucketId) => void;
  onReorderWithin: (bucket: TaskBucketId, orderedIds: number[]) => void;
  onCreateInGroup: (bucket: TaskBucketId) => void;
}

const findBucketOf = (groups: GroupedTasks, taskId: number): TaskBucketId | null => {
  for (const meta of TASK_BUCKETS) {
    if (groups[meta.id].some((t) => t.id === taskId)) return meta.id;
  }
  return null;
};

export const TaskListView: React.FC<TaskListViewProps> = ({
  groups,
  isLoading,
  selectedTaskId,
  timeZone,
  onOpenTask,
  onToggleComplete,
  onPatchTask,
  onMoveToBucket,
  onReorderWithin,
  onCreateInGroup,
}) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dragging, setDragging] = useState<Task | null>(null);

  const sensors = useSensors(
    // A few pixels of slop so a click on a row is never read as a drag.
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const totalCount = useMemo(
    () => TASK_BUCKETS.reduce((n, m) => n + groups[m.id].length, 0),
    [groups]
  );

  const toggleCollapsed = (id: TaskBucketId) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task as Task | undefined;
    setDragging(task ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDragging(null);
    if (!over) return;

    const activeId = Number(active.id);
    const from = findBucketOf(groups, activeId);
    if (!from) return;

    const task = groups[from].find((t) => t.id === activeId);
    if (!task) return;

    // Dropped on a group header/empty area -> that bucket. Dropped on another
    // row -> that row's bucket.
    const overData = over.data.current as { type?: string; bucket?: TaskBucketId } | undefined;
    const to =
      overData?.type === 'bucket'
        ? (overData.bucket as TaskBucketId)
        : findBucketOf(groups, Number(over.id));

    if (!to) return;

    if (to !== from) {
      onMoveToBucket(task, to);
      return;
    }

    // Same group: pure reorder.
    const ids = groups[from].map((t) => t.id);
    const oldIndex = ids.indexOf(activeId);
    const newIndex = ids.indexOf(Number(over.id));
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
    onReorderWithin(from, arrayMove(ids, oldIndex, newIndex));
  };

  if (isLoading && totalCount === 0) {
    return (
      <div className="space-y-2 p-2" data-testid="task-list-loading">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToWindowEdges]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="group/list space-y-1.5 p-1.5" data-testid="task-list">
        {TASK_BUCKETS.map((meta) => (
          <TaskGroupSection
            key={meta.id}
            meta={meta}
            tasks={groups[meta.id]}
            collapsed={Boolean(collapsed[meta.id])}
            onToggleCollapsed={toggleCollapsed}
            selectedTaskId={selectedTaskId}
            timeZone={timeZone}
            onOpenTask={onOpenTask}
            onToggleComplete={onToggleComplete}
            onPatchTask={onPatchTask}
            onCreateInGroup={onCreateInGroup}
          />
        ))}

        {totalCount === 0 && !isLoading && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <CheckSquare className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">Nothing here</p>
            <p className="text-xs text-muted-foreground">
              No tasks match this view. Try clearing the filters, or add one.
            </p>
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div className="rounded border bg-background px-2 py-1.5 text-sm shadow-lg">
            {dragging.title}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default TaskListView;
