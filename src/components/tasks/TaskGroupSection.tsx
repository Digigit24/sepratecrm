// src/components/tasks/TaskGroupSection.tsx
//
// One collapsible group (Overdue / Today / This week / Later / Done) with its
// header count, plus the droppable region that lets a row be dragged into this
// bucket to be re-dated.

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Task, UpdateTaskPayload } from '@/types/crmTypes';
import type { TaskBucketId, TaskBucketMeta } from '@/utils/taskGrouping';
import { TaskRow } from './TaskRow';

export interface TaskGroupSectionProps {
  meta: TaskBucketMeta;
  tasks: Task[];
  collapsed: boolean;
  onToggleCollapsed: (id: TaskBucketId) => void;
  selectedTaskId: number | null;
  timeZone: string;
  onOpenTask: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  onPatchTask: (id: number, patch: Partial<UpdateTaskPayload>) => void;
  onCreateInGroup: (bucket: TaskBucketId) => void;
  sortingDisabled?: boolean;
}

export const TaskGroupSection: React.FC<TaskGroupSectionProps> = ({
  meta,
  tasks,
  collapsed,
  onToggleCollapsed,
  selectedTaskId,
  timeZone,
  onOpenTask,
  onToggleComplete,
  onPatchTask,
  onCreateInGroup,
  sortingDisabled,
}) => {
  // The whole section is the drop target, so a row can be dropped onto an
  // empty group as well as between existing rows.
  const { setNodeRef, isOver } = useDroppable({
    id: `bucket:${meta.id}`,
    disabled: !meta.droppable,
    data: { type: 'bucket', bucket: meta.id },
  });

  const isOverdue = meta.id === 'overdue';

  return (
    <section
      ref={setNodeRef}
      data-testid={`task-group-${meta.id}`}
      data-over={isOver ? 'true' : undefined}
      className={cn(
        'rounded-md transition-colors',
        isOver && meta.droppable && 'bg-primary/5 ring-1 ring-primary/30'
      )}
    >
      <header className="flex items-center gap-1.5 px-1 py-1.5">
        <button
          type="button"
          onClick={() => onToggleCollapsed(meta.id)}
          aria-expanded={!collapsed}
          className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-muted"
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform',
              !collapsed && 'rotate-90'
            )}
          />
          <span
            className={cn(
              'text-xs font-semibold uppercase tracking-wide',
              isOverdue && tasks.length > 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-muted-foreground'
            )}
          >
            {meta.label}
          </span>
          <span
            data-testid={`task-group-count-${meta.id}`}
            className={cn(
              'rounded-full px-1.5 text-[11px] tabular-nums',
              isOverdue && tasks.length > 0
                ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {tasks.length}
          </span>
        </button>

        <div className="flex-1" />

        {meta.id !== 'done' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/list:opacity-100 hover:opacity-100"
            aria-label={`Add a task to ${meta.label}`}
            onClick={() => onCreateInGroup(meta.id)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </header>

      {!collapsed && (
        <div className="border-t border-border/60">
          <SortableContext
            items={tasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                isSelected={task.id === selectedTaskId}
                isOverdue={isOverdue}
                timeZone={timeZone}
                onOpen={onOpenTask}
                onToggleComplete={onToggleComplete}
                onPatch={onPatchTask}
                sortingDisabled={sortingDisabled}
              />
            ))}
          </SortableContext>

          {tasks.length === 0 && (
            <p className="px-3 py-2.5 text-xs text-muted-foreground">{meta.emptyHint}</p>
          )}
        </div>
      )}
    </section>
  );
};

export default TaskGroupSection;
