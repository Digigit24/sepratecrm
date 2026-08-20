// src/components/tasks/TaskChecklist.tsx
//
// The side panel's checklist.
//
// The `/tasks/{id}/checklist/` routes are part of the contract being built in
// parallel, so this component has to work three ways:
//   1. routes present  -> full add / toggle / rename / delete
//   2. routes missing  -> a calm inline notice; if the task serializer already
//                         carries `checklist_items`, they are still SHOWN, just
//                         read-only. Nothing crashes and nothing is a red toast.
//   3. no data at all  -> "No checklist yet".

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Info, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  isTasksEndpointUnavailable,
  taskReadSwrOptions,
  tasksService,
} from '@/services/tasksService';
import type { Task, TaskChecklistItem } from '@/types/crmTypes';

export interface TaskChecklistProps {
  task: Task;
  onChanged?: () => void;
}

export const TaskChecklist: React.FC<TaskChecklistProps> = ({ task, onChanged }) => {
  const [unavailable, setUnavailable] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, error, mutate, isLoading } = useSWR<TaskChecklistItem[]>(
    unavailable ? null : ['task-checklist', task.id],
    () => tasksService.getChecklist(task.id),
    {
      ...taskReadSwrOptions,
      onError: (err) => {
        if (isTasksEndpointUnavailable(err)) setUnavailable(true);
      },
    }
  );

  // Reset the "unavailable" latch when moving to another task, so one missing
  // route does not permanently disable the section for the whole session.
  useEffect(() => {
    setUnavailable(false);
    setDraft('');
  }, [task.id]);

  const endpointMissing = unavailable || isTasksEndpointUnavailable(error);
  // Fall back to whatever the task serializer already carried.
  const items: TaskChecklistItem[] = endpointMissing
    ? task.checklist_items ?? []
    : data ?? task.checklist_items ?? [];

  const readOnly = endpointMissing;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await mutate();
      onChanged?.();
    } catch (err) {
      if (isTasksEndpointUnavailable(err)) {
        setUnavailable(true);
        return;
      }
      toast.error(err instanceof Error ? err.message : 'Could not update the checklist');
    } finally {
      setBusy(false);
    }
  };

  const done = items.filter((i) => i.is_done).length;

  return (
    <div data-testid="task-checklist">
      <div className="mb-2 flex items-center justify-between px-0.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Checklist
        </h3>
        {items.length > 0 && (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {done}/{items.length}
          </span>
        )}
      </div>

      {endpointMissing && (
        <div
          data-testid="task-checklist-unavailable"
          className="mb-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p className="text-xs">
            Checklists are not available on this server yet.
            {items.length > 0 ? ' Existing items are shown read-only.' : ''}
          </p>
        </div>
      )}

      {isLoading && !endpointMissing && items.length === 0 ? (
        <p className="px-0.5 text-xs text-muted-foreground">Loading...</p>
      ) : items.length === 0 ? (
        <p className="px-0.5 text-xs text-muted-foreground">No checklist yet.</p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={item.id} className="group flex items-center gap-2 rounded px-0.5 py-1 hover:bg-muted/50">
              <Checkbox
                checked={item.is_done}
                disabled={readOnly || busy}
                aria-label={item.title}
                onCheckedChange={() =>
                  run(() =>
                    tasksService.updateChecklistItem(task.id, item.id, { is_done: !item.is_done })
                  )
                }
              />
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-sm',
                  item.is_done && 'text-muted-foreground line-through'
                )}
              >
                {item.title}
              </span>
              {!readOnly && (
                <button
                  type="button"
                  aria-label={`Delete ${item.title}`}
                  disabled={busy}
                  onClick={() => run(() => tasksService.deleteChecklistItem(task.id, item.id))}
                  className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <form
          className="mt-2 flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            const title = draft.trim();
            if (!title) return;
            setDraft('');
            run(() => tasksService.addChecklistItem(task.id, title));
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a step..."
            disabled={busy}
            className="h-8 text-xs"
            aria-label="Add a checklist item"
          />
          <Button type="submit" size="icon" variant="ghost" className="h-8 w-8" disabled={busy || !draft.trim()}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </form>
      )}
    </div>
  );
};

export default TaskChecklist;
