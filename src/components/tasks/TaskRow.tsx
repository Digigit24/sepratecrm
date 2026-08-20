// src/components/tasks/TaskRow.tsx
//
// One dense line in the grouped list.
//
// Everything the eye needs is on the row, and the three things people change
// most often -- done, deadline, assignee -- are editable IN PLACE. Opening the
// side panel is for the rest. That is the whole difference between this and the
// old DataTable: completing four tasks used to be four drawer round-trips.
//
// The row is a @dnd-kit sortable item. Drag is on an explicit grip handle, not
// the whole row, so clicking a row to open the panel can never be swallowed by
// a drag that was really a click.

import { memo, useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarClock, GripVertical, Link2, ListChecks, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/user';
import { useUserDirectory } from '@/hooks/useUserDirectory';
import { PriorityEnum, type Task, type UpdateTaskPayload } from '@/types/crmTypes';
import {
  dueDateFromInput,
  dueDateInputValue,
  dueTimeInputValue,
  formatDueLabel,
  isTaskDone,
} from '@/utils/taskGrouping';
import { resolveRelatedType } from './taskDraft';

const UNASSIGNED = '__unassigned__';

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
  MEDIUM:
    'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  LOW: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700',
};

export interface TaskRowProps {
  task: Task;
  isSelected?: boolean;
  isOverdue?: boolean;
  timeZone: string;
  onOpen: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  onPatch: (id: number, patch: Partial<UpdateTaskPayload>) => void;
  /** Disables drag when the list is showing a filtered/derived order. */
  sortingDisabled?: boolean;
}

/** Inline deadline editor. Opens on the due chip, never navigates. */
const DueEditor: React.FC<{
  task: Task;
  timeZone: string;
  isOverdue: boolean;
  onPatch: TaskRowProps['onPatch'];
}> = ({ task, timeZone, isOverdue, onPatch }) => {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(() => dueDateInputValue(task, timeZone));
  const [time, setTime] = useState(() =>
    task.due_date ? dueTimeInputValue(task, timeZone) : '17:00'
  );

  useEffect(() => {
    if (!open) return;
    setDay(dueDateInputValue(task, timeZone));
    setTime(task.due_date ? dueTimeInputValue(task, timeZone) : '17:00');
  }, [open, task, timeZone]);

  const commit = () => {
    const next = day ? dueDateFromInput(day, task.is_all_day ? '00:00' : time, timeZone) : null;
    if (next !== (task.due_date ?? null)) {
      onPatch(task.id, { due_date: next ?? undefined });
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="task-row-due"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs whitespace-nowrap',
            'hover:bg-muted transition-colors',
            isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground'
          )}
        >
          <CalendarClock className="h-3 w-3" />
          {formatDueLabel(task, { timeZone })}
          {!task.is_all_day && task.due_date && (
            <span className="opacity-70">{dueTimeInputValue(task, timeZone)}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-3 space-y-2"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="Due date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="h-8 text-xs"
          />
          {!task.is_all_day && (
            <Input
              type="time"
              aria-label="Due time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={!day}
              className="h-8 w-[104px] text-xs"
            />
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setDay('');
              onPatch(task.id, { due_date: undefined });
              setOpen(false);
            }}
          >
            Clear
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={commit}>
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

/** Inline assignee picker, backed by the one canonical user directory. */
const AssigneeEditor: React.FC<{
  task: Task;
  onPatch: TaskRowProps['onPatch'];
}> = ({ task, onPatch }) => {
  const { users, isLoading, getName } = useUserDirectory();
  const active = users.filter((u) => u.isActive);

  return (
    <div onClick={(e) => e.stopPropagation()} data-testid="task-row-assignee">
      <Select
        value={task.assignee_user_id || UNASSIGNED}
        onValueChange={(v) =>
          onPatch(task.id, { assignee_user_id: v === UNASSIGNED ? '' : v })
        }
        disabled={isLoading}
      >
        <SelectTrigger
          className="h-7 w-auto min-w-0 gap-1 border-0 bg-transparent px-1.5 text-xs shadow-none hover:bg-muted focus:ring-0"
          aria-label={`Assignee: ${getName(task.assignee_user_id)}`}
        >
          <UserAvatar id={task.assignee_user_id || null} size="xs" />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
          {active.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              <UserAvatar id={u.id} size="xs" showName />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export const TaskRow: React.FC<TaskRowProps> = memo(
  ({ task, isSelected, isOverdue, timeZone, onOpen, onToggleComplete, onPatch, sortingDisabled }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: task.id,
      disabled: sortingDisabled,
      data: { type: 'task', task },
    });

    const done = isTaskDone(task);
    const relatedType = resolveRelatedType(task);
    const relatedLabel = task.related_label || task.lead_name;
    const checklistTotal = task.checklist_total_count ?? 0;

    // A drag that never moved must still register as a click on the row.
    const pressedAt = useRef<{ x: number; y: number } | null>(null);

    return (
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Translate.toString(transform), transition }}
        data-testid="task-row"
        data-task-id={task.id}
        data-selected={isSelected ? 'true' : undefined}
        className={cn(
          'group flex items-center gap-2 border-b border-border/50 px-2 py-1.5 text-sm',
          'cursor-pointer transition-colors',
          isSelected ? 'bg-primary/10' : 'hover:bg-muted/60',
          isDragging && 'opacity-40',
          isOverdue && !done && 'bg-red-50/60 dark:bg-red-950/20'
        )}
        onPointerDown={(e) => {
          pressedAt.current = { x: e.clientX, y: e.clientY };
        }}
        onClick={(e) => {
          const from = pressedAt.current;
          if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) > 4) return;
          onOpen(task);
        }}
      >
        {/* drag handle */}
        <button
          type="button"
          aria-label="Reorder task"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'shrink-0 cursor-grab text-muted-foreground/40 opacity-0 transition-opacity',
            'group-hover:opacity-100 focus-visible:opacity-100',
            sortingDisabled && 'pointer-events-none'
          )}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
          <Checkbox
            checked={done}
            onCheckedChange={() => onToggleComplete(task)}
            aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
            data-testid="task-row-checkbox"
          />
        </div>

        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            done && 'text-muted-foreground line-through'
          )}
          title={task.title}
        >
          {task.title}
        </span>

        {/* meta, right-aligned and compact */}
        <div className="flex shrink-0 items-center gap-1.5">
          {task.rrule && (
            <Repeat className="h-3 w-3 text-muted-foreground" aria-label="Repeats" />
          )}

          {checklistTotal > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
              <ListChecks className="h-3 w-3" />
              {task.checklist_done_count ?? 0}/{checklistTotal}
            </span>
          )}

          {(task.labels || []).slice(0, 2).map((label) => (
            <Badge key={label} variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
              {label}
            </Badge>
          ))}

          {relatedType !== 'NONE' && relatedLabel && (
            <span
              className="hidden items-center gap-0.5 text-[11px] text-muted-foreground md:inline-flex max-w-[140px] truncate"
              title={`${relatedType}: ${relatedLabel}`}
            >
              <Link2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{relatedLabel}</span>
            </span>
          )}

          {task.priority !== PriorityEnum.MEDIUM && (
            <Badge
              variant="outline"
              className={cn('h-5 px-1.5 text-[10px] font-normal', PRIORITY_STYLES[task.priority])}
            >
              {task.priority}
            </Badge>
          )}

          <DueEditor task={task} timeZone={timeZone} isOverdue={Boolean(isOverdue)} onPatch={onPatch} />

          <AssigneeEditor task={task} onPatch={onPatch} />
        </div>
      </div>
    );
  }
);

TaskRow.displayName = 'TaskRow';

export default TaskRow;
