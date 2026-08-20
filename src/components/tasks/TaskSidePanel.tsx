// src/components/tasks/TaskSidePanel.tsx
//
// The right-hand detail pane. NOT a modal -- that is the whole point.
//
// The list stays mounted, visible and fully usable while this is open: you can
// tick a checkbox or drag a row in the list with the panel showing, and click
// straight from one row to the next without an open/close animation each time.
// A Radix Dialog/Sheet would trap focus and block the page behind it, so this
// is a plain flex sibling of the list instead.
//
// It renders the SAME <TaskFormFields> the drawer does, so the two surfaces
// cannot drift apart the way the two old drawers did.
//
// Saving is explicit: the draft is local, and Save/Cancel appear once something
// is actually dirty. Status and completion are the exception -- those write
// immediately, because they are the things people flip fastest.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExternalLink, Loader2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { useCRM } from '@/hooks/useCRM';
import { TaskFormFields } from './TaskFormFields';
import { TaskChecklist } from './TaskChecklist';
import {
  draftFromTask,
  draftToPayload,
  resolveRelatedId,
  resolveRelatedType,
  type TaskDraft,
} from './taskDraft';
import { TASK_STATUS_OPTIONS, TaskStatusEnum, type Task, type UpdateTaskPayload } from '@/types/crmTypes';

export interface TaskSidePanelProps {
  taskId: number;
  onClose: () => void;
  onSaved?: () => void;
  onDeleted?: (id: number) => void;
  /** Writes through the manager so the list updates optimistically. */
  onPatch: (id: number, patch: Partial<UpdateTaskPayload>) => void;
}

/** Deep link to the CRM record a task hangs off, when we can build one. */
const relatedHref = (task: Task): string | null => {
  const type = resolveRelatedType(task);
  const id = resolveRelatedId(task);
  if (!id) return null;
  switch (type) {
    case 'LEAD':
      return `/crm/leads?lead=${id}`;
    case 'MEETING':
      return `/crm/meetings?meeting=${id}`;
    default:
      // Projects and Units have no route in this app yet.
      return null;
  }
};

const isDirty = (a: TaskDraft, b: TaskDraft): boolean => JSON.stringify(a) !== JSON.stringify(b);

export const TaskSidePanel: React.FC<TaskSidePanelProps> = ({
  taskId,
  onClose,
  onSaved,
  onDeleted,
  onPatch,
}) => {
  const { useTask, updateTask, deleteTask } = useCRM();
  const { data: task, isLoading, error, mutate } = useTask(taskId);

  const baseDraft = useMemo(() => (task ? draftFromTask(task) : null), [task]);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraft(baseDraft);
  }, [baseDraft]);

  const patchDraft = useCallback((patch: Partial<TaskDraft>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const dirty = Boolean(draft && baseDraft && isDirty(draft, baseDraft));

  const handleSave = useCallback(async () => {
    if (!draft || !task) return;
    setIsSaving(true);
    try {
      await updateTask(task.id, draftToPayload(draft) as UpdateTaskPayload);
      toast.success('Task saved');
      await mutate();
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setIsSaving(false);
    }
  }, [draft, task, updateTask, mutate, onSaved]);

  const handleDelete = useCallback(async () => {
    if (!task) return;
    if (!window.confirm('Delete this task? This cannot be undone.')) return;
    try {
      await deleteTask(task.id);
      toast.success('Task deleted');
      onDeleted?.(task.id);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete task');
    }
  }, [task, deleteTask, onDeleted, onClose]);

  const href = task ? relatedHref(task) : null;
  const relatedLabel = task?.related_label || task?.lead_name;

  return (
    <aside
      data-testid="task-side-panel"
      aria-label="Task details"
      className="flex h-full w-full flex-col border-l bg-background md:w-[420px] md:shrink-0"
    >
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {task?.title || (isLoading ? 'Loading...' : 'Task')}
        </h2>
        {task && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Delete task"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Close task details"
          data-testid="task-panel-close"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      {error && !task ? (
        <div className="p-4">
          <p className="text-sm font-medium">Could not load this task</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {error instanceof Error ? error.message : 'It may have been deleted.'}
          </p>
          <Button variant="outline" size="sm" className="mt-3 h-7 text-xs" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : isLoading && !task ? (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading task...
        </div>
      ) : task && draft ? (
        <>
          <ScrollArea className="flex-1">
            <div className="space-y-4 px-3 py-3">
              {/* Status writes straight through -- no Save needed. */}
              <div className="flex items-center gap-2">
                <Select
                  value={task.status}
                  onValueChange={(v) => onPatch(task.id, { status: v as TaskStatusEnum })}
                >
                  <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {relatedLabel && (
                  <Badge variant="outline" className="gap-1 text-[11px] font-normal">
                    {resolveRelatedType(task)}
                    {href ? (
                      <Link to={href} className="inline-flex items-center gap-0.5 underline">
                        {relatedLabel}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span>{relatedLabel}</span>
                    )}
                  </Badge>
                )}
              </div>

              <TaskFormFields
                draft={draft}
                onChange={patchDraft}
                disabled={isSaving}
                hideStatus
                relatedLabel={relatedLabel}
              />

              <Separator />

              <TaskChecklist task={task} onChanged={() => mutate()} />

              <Separator />

              <div className="space-y-1 text-[11px] text-muted-foreground">
                <p>
                  Created {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                </p>
                <p>
                  Updated {formatDistanceToNow(new Date(task.updated_at), { addSuffix: true })}
                </p>
                {task.completed_at && (
                  <p>
                    Completed{' '}
                    {formatDistanceToNow(new Date(task.completed_at), { addSuffix: true })}
                  </p>
                )}
                <p>Task #{task.id}</p>
              </div>
            </div>
          </ScrollArea>

          {dirty && (
            <footer className="flex items-center justify-end gap-2 border-t px-3 py-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setDraft(baseDraft)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </footer>
          )}
        </>
      ) : null}
    </aside>
  );
};

export default TaskSidePanel;
