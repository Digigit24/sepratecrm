// src/components/lead-drawer/LeadTasks.tsx
import { useState, useCallback, useMemo } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Calendar, Loader2, CheckCircle2, Circle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, isToday, isPast, isFuture, startOfDay, differenceInDays } from 'date-fns';
import type { Task, TaskStatusEnum, PriorityEnum } from '@/types/crmTypes';
import TaskFormDrawer from '@/components/TaskFormDrawer';

interface LeadTasksProps {
  leadId: number;
  leadAssignedTo?: string | null;
}

type TaskGroup = {
  title: string;
  tasks: Task[];
  icon: React.ReactNode;
  color: string;
};

export const LeadTasks: React.FC<LeadTasksProps> = ({ leadId, leadAssignedTo }) => {
  const { useTasks, patchTask } = useCRM();

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'create'>('view');

  // Fetch tasks for this lead
  const {
    data: tasksData,
    isLoading: tasksLoading,
    mutate: mutateTasks,
  } = useTasks({ lead: leadId, ordering: 'due_date' });

  const tasks = tasksData?.results || [];

  // Group tasks by date
  const groupedTasks = useMemo<TaskGroup[]>(() => {
    const now = new Date();
    const groups: TaskGroup[] = [];

    const overdueTasks = tasks.filter(
      (task) =>
        task.status !== 'DONE' &&
        task.status !== 'CANCELLED' &&
        task.due_date &&
        isPast(startOfDay(parseISO(task.due_date))) &&
        !isToday(parseISO(task.due_date))
    );

    const todayTasks = tasks.filter(
      (task) => task.due_date && isToday(parseISO(task.due_date))
    );

    const upcomingTasks = tasks.filter(
      (task) =>
        task.due_date &&
        isFuture(startOfDay(parseISO(task.due_date))) &&
        !isToday(parseISO(task.due_date))
    );

    const noDateTasks = tasks.filter((task) => !task.due_date);

    if (overdueTasks.length > 0) {
      groups.push({
        title: 'Overdue',
        tasks: overdueTasks,
        icon: <Clock className="h-4 w-4" />,
        color: 'text-red-600',
      });
    }

    if (todayTasks.length > 0) {
      groups.push({
        title: 'Today',
        tasks: todayTasks,
        icon: <CheckCircle2 className="h-4 w-4" />,
        color: 'text-blue-600',
      });
    }

    if (upcomingTasks.length > 0) {
      groups.push({
        title: 'Upcoming',
        tasks: upcomingTasks,
        icon: <Calendar className="h-4 w-4" />,
        color: 'text-green-600',
      });
    }

    if (noDateTasks.length > 0) {
      groups.push({
        title: 'No Due Date',
        tasks: noDateTasks,
        icon: <Circle className="h-4 w-4" />,
        color: 'text-gray-600',
      });
    }

    return groups;
  }, [tasks]);

  // Handle create task button
  const handleCreateClick = useCallback(() => {
    setSelectedTaskId(null);
    setDrawerMode('create');
    setDrawerOpen(true);
  }, []);

  // Handle view task
  const handleViewTask = useCallback((task: Task) => {
    setSelectedTaskId(task.id);
    setDrawerMode('view');
    setDrawerOpen(true);
  }, []);

  // Handle drawer success
  const handleDrawerSuccess = useCallback(() => {
    mutateTasks();
  }, [mutateTasks]);

  // Handle drawer delete
  const handleDrawerDelete = useCallback(() => {
    mutateTasks();
  }, [mutateTasks]);

  // Handle task completion toggle
  const handleToggleComplete = useCallback(
    async (task: Task, event: React.MouseEvent) => {
      // Prevent triggering the card click
      event.stopPropagation();

      try {
        const newStatus: TaskStatusEnum = task.status === 'DONE' ? 'TODO' : 'DONE';
        const updatePayload: any = {
          status: newStatus,
        };

        // Set completed_at when marking as done
        if (newStatus === 'DONE') {
          updatePayload.completed_at = new Date().toISOString();
        }

        await patchTask(task.id, updatePayload);
        mutateTasks();
        toast.success(
          newStatus === 'DONE' ? 'Task marked as complete' : 'Task marked as incomplete'
        );
      } catch (error: any) {
        toast.error(error.message || 'Failed to update task');
      }
    },
    [patchTask, mutateTasks]
  );

  // Get priority badge color
  const getPriorityColor = (priority: PriorityEnum) => {
    switch (priority) {
      case 'HIGH':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'MEDIUM':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'LOW':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Format due date
  const formatDueDate = (dueDate: string) => {
    try {
      const date = parseISO(dueDate);
      if (isToday(date)) {
        return 'Today';
      }
      const days = differenceInDays(date, new Date());
      if (days === 1) return 'Tomorrow';
      if (days === -1) return 'Yesterday';
      if (days > 1 && days < 7) return `In ${days} days`;
      if (days < -1 && days > -7) return `${Math.abs(days)} days ago`;
      return format(date, 'MMM dd, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <div className="space-y-1">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
          Tasks{tasks.length > 0 ? ` · ${tasks.length}` : ''}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCreateClick}
          className="h-7 text-xs px-2.5 rounded-md gap-1 border-border/60 hover:border-primary/40 hover:text-primary"
        >
          <Plus className="h-3 w-3" />
          Add task
        </Button>
      </div>

      {/* Body */}
      {tasksLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <div className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center mb-3">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground">No tasks yet</p>
          <button
            type="button"
            onClick={handleCreateClick}
            className="mt-2 text-xs text-primary hover:underline underline-offset-2"
          >
            Add the first task
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedTasks.map((group) => (
            <div key={group.title}>
              {/* Group header */}
              <div className="flex items-center gap-2 mb-1.5 px-1">
                <span className={`${group.color} flex-shrink-0`} style={{ fontSize: 12 }}>
                  {group.icon}
                </span>
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${group.color}`}>
                  {group.title}
                </span>
                <span className="text-[10px] text-muted-foreground/60">· {group.tasks.length}</span>
              </div>

              {/* Task rows — flat, Notion-style */}
              <div className="border border-border/50 rounded-lg overflow-hidden shadow-sm divide-y divide-border/40">
                {group.tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleViewTask(task)}
                    className={`flex items-start gap-3 px-3 py-2.5 bg-card hover:bg-muted/40 transition-colors cursor-pointer ${
                      task.status === 'DONE' ? 'opacity-55' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="pt-0.5 flex-shrink-0">
                      <Checkbox
                        checked={task.status === 'DONE'}
                        onCheckedChange={(_, event) => handleToggleComplete(task, event as any)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-3.5 w-3.5"
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 justify-between">
                        <span
                          className={`text-sm leading-snug ${
                            task.status === 'DONE'
                              ? 'line-through text-muted-foreground'
                              : 'text-foreground font-medium'
                          }`}
                        >
                          {task.title}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border leading-none flex-shrink-0 ${getPriorityColor(task.priority)}`}>
                          {task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}
                        </span>
                      </div>

                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {task.description}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                        {task.due_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-2.5 w-2.5" />
                            {formatDueDate(task.due_date)}
                          </span>
                        )}
                        {task.completed_at && (
                          <span className="text-green-600/70">
                            Done {format(parseISO(task.completed_at), 'MMM d')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Task Form Drawer */}
      <TaskFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        taskId={selectedTaskId}
        leadId={leadId}
        mode={drawerMode}
        onSuccess={handleDrawerSuccess}
        onDelete={handleDrawerDelete}
        onModeChange={setDrawerMode}
        defaultAssignedTo={drawerMode === 'create' ? (leadAssignedTo ?? null) : null}
      />
    </div>
  );
};

export default LeadTasks;
