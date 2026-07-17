// src/components/lead-drawer/LeadTasksBlock.tsx
//
// Notion-style inline Tasks block for the lead Overview surface:
//  - collapsible; the list is hidden when there are no tasks (only the
//    "＋ New task" affordance shows),
//  - light divide-y rows with a checkbox (toggle DONE via patchTask),
//  - always-visible "＋ New task" opening the existing TaskFormDrawer,
//  - AI-created tasks appear on SWR refresh (useCrmDataChanged).
//
// Complements the full LeadTasks tab (kept for power/grouped view — progressive
// D-2). This is presentation-only over the same useTasks/patchTask API.

import { useMemo, useState } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { useCrmDataChanged } from '@/lib/crmEvents';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronRight, Plus, Loader2, CalendarClock } from 'lucide-react';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { toast } from 'sonner';
import { TaskStatusEnum } from '@/types/crmTypes';
import type { Task } from '@/types/crmTypes';
import TaskFormDrawer from '@/components/TaskFormDrawer';
import { cn } from '@/lib/utils';

interface LeadTasksBlockProps {
  leadId: number;
  leadAssignedTo?: string | null;
}

function DueChip({ due }: { due?: string | null }) {
  if (!due) return null;
  let d: Date;
  try {
    d = parseISO(due);
  } catch {
    return null;
  }
  const overdue = isPast(d) && !isToday(d);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px]',
        overdue ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground',
      )}
    >
      <CalendarClock className="h-2.5 w-2.5" />
      {format(d, 'MMM d')}
    </span>
  );
}

export function LeadTasksBlock({ leadId, leadAssignedTo }: LeadTasksBlockProps) {
  const { useTasks, patchTask } = useCRM();
  const { data, isLoading, mutate } = useTasks({ lead: leadId, ordering: 'due_date', page_size: 50 });
  const [open, setOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  useCrmDataChanged((e) => {
    if (e.resource === 'tasks') mutate();
  });

  const tasks = useMemo(() => data?.results ?? [], [data]);
  const hasTasks = tasks.length > 0;

  // Auto-expand once tasks exist so they're visible; stays collapsible.
  const expanded = open || hasTasks;

  const toggleDone = async (task: Task) => {
    const next = task.status === TaskStatusEnum.DONE ? TaskStatusEnum.TODO : TaskStatusEnum.DONE;
    setBusyId(task.id);
    try {
      await patchTask(task.id, { status: next });
      mutate();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update task');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="border-t border-border/30 pt-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 hover:text-foreground"
        >
          <ChevronRight className={cn('h-3 w-3 transition-transform', expanded && 'rotate-90')} />
          Tasks{hasTasks ? ` (${tasks.length})` : ''}
        </button>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> New task
        </button>
      </div>

      {expanded && (
        <div className="mt-1">
          {isLoading ? (
            <p className="py-2 text-[12px] text-muted-foreground/60">Loading tasks…</p>
          ) : !hasTasks ? (
            <p className="py-2 text-[12px] text-muted-foreground/50">No tasks yet.</p>
          ) : (
            <div className="divide-y divide-border/20">
              {tasks.map((t) => {
                const done = t.status === TaskStatusEnum.DONE;
                return (
                  <div key={t.id} className="flex items-center gap-2.5 py-1.5">
                    {busyId === t.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : (
                      <Checkbox checked={done} onCheckedChange={() => toggleDone(t)} />
                    )}
                    <span className={cn('min-w-0 flex-1 truncate text-[13px]', done && 'text-muted-foreground line-through')}>
                      {t.title}
                    </span>
                    <DueChip due={t.due_date} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <TaskFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        taskId={null}
        leadId={leadId}
        defaultAssignedTo={leadAssignedTo ?? undefined}
        mode="create"
        onSuccess={() => mutate()}
      />
    </div>
  );
}

export default LeadTasksBlock;
