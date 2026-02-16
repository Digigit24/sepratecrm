// src/components/lead-drawer/LeadTasks.tsx
import { useState, useCallback, useMemo } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Calendar, Loader2, CheckCircle2, Circle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, isToday, isPast, isFuture, startOfDay, differenceInDays } from 'date-fns';
import type { Task, TaskStatusEnum, PriorityEnum } from '@/types/crmTypes';
import TaskFormDrawer from '@/components/TaskFormDrawer';

interface LeadTasksProps {
  leadId: number;
}

type TaskGroup = {
  title: string;
  tasks: Task[];
  icon: React.ReactNode;
  color: string;
};

export const LeadTasks: React.FC<LeadTasksProps> = ({ leadId }) => {
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
    <div className="space-y-6">
      {/* Create Task Button */}
      <div className="flex justify-end">
        <Button onClick={handleCreateClick}>
          <Plus className="h-4 w-4 mr-2" />
          Create Task
        </Button>
      </div>

      {/* Tasks List */}
      {tasksLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <p className="text-muted-foreground">No tasks yet for this lead</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first task using the form above
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedTasks.map((group) => (
            <Card key={group.title}>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <span className={group.color}>{group.icon}</span>
                  <CardTitle className={`text-lg ${group.color}`}>
                    {group.title} ({group.tasks.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {group.tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-start gap-3 p-3 border rounded-lg hover:bg-accent transition-colors cursor-pointer ${
                      task.status === 'DONE' ? 'opacity-60' : ''
                    }`}
                    onClick={() => handleViewTask(task)}
                  >
                    <Checkbox
                      checked={task.status === 'DONE'}
                      onCheckedChange={(checked, event) => handleToggleComplete(task, event as any)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4
                          className={`font-medium ${
                            task.status === 'DONE' ? 'line-through text-muted-foreground' : ''
                          }`}
                        >
                          {task.title}
                        </h4>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border ${getPriorityColor(
                            task.priority
                          )}`}
                        >
                          {task.priority}
                        </span>
                      </div>

                      {task.description && (
                        <p
                          className={`text-sm mt-1 ${
                            task.status === 'DONE'
                              ? 'line-through text-muted-foreground'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {task.description}
                        </p>
                      )}

                      {task.due_date && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDueDate(task.due_date)}</span>
                        </div>
                      )}

                      {task.completed_at && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Completed: {format(parseISO(task.completed_at), 'MMM dd, yyyy hh:mm a')}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
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
      />
    </div>
  );
};

export default LeadTasks;
