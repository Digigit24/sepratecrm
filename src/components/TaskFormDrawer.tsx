// src/components/TaskFormDrawer.tsx
import { useState, useEffect, useCallback } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Task, TaskStatusEnum, PriorityEnum } from '@/types/crmTypes';
import { SideDrawer, type DrawerActionButton, type DrawerHeaderAction } from '@/components/SideDrawer';

interface TaskFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId?: number | null;
  leadId?: number | null;
  mode: 'view' | 'edit' | 'create';
  onSuccess?: () => void;
  onDelete?: (id: number) => void;
  onModeChange?: (mode: 'view' | 'edit' | 'create') => void;
}

export const TaskFormDrawer: React.FC<TaskFormDrawerProps> = ({
  open,
  onOpenChange,
  taskId,
  leadId,
  mode,
  onSuccess,
  onDelete,
  onModeChange,
}) => {
  const { user } = useAuth();
  const { useTask, createTask, updateTask, deleteTask } = useCRM();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<PriorityEnum>('MEDIUM');
  const [status, setStatus] = useState<TaskStatusEnum>('TODO');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch task data if editing/viewing
  const { data: task, isLoading: taskLoading } = useTask(
    mode !== 'create' && taskId ? taskId : null
  );

  // Populate form when task data is loaded
  useEffect(() => {
    if (task && mode !== 'create') {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setPriority(task.priority || 'MEDIUM');
      setStatus(task.status || 'TODO');
      setDueDate(task.due_date ? task.due_date.split('T')[0] : '');
    } else if (mode === 'create') {
      setTitle('');
      setDescription('');
      setPriority('MEDIUM');
      setStatus('TODO');
      setDueDate('');
    }
  }, [task, mode]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSwitchToEdit = useCallback(() => {
    onModeChange?.('edit');
  }, [onModeChange]);

  const handleSwitchToView = useCallback(() => {
    onModeChange?.('view');
    // Reset form to original values
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setPriority(task.priority || 'MEDIUM');
      setStatus(task.status || 'TODO');
      setDueDate(task.due_date ? task.due_date.split('T')[0] : '');
    }
  }, [onModeChange, task]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      toast.error('Task title is required');
      return;
    }

    if (mode === 'create' && !leadId) {
      toast.error('Lead ID is required to create a task');
      return;
    }

    try {
      setIsSubmitting(true);

      const taskData: any = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        status,
        owner_user_id: user?.id,
      };

      if (mode === 'create') {
        taskData.lead = leadId;
      }

      if (dueDate) {
        taskData.due_date = new Date(dueDate).toISOString();
      }

      if (mode === 'create') {
        await createTask(taskData);
        toast.success('Task created successfully');
      } else if (mode === 'edit' && taskId) {
        await updateTask(taskId, taskData);
        toast.success('Task updated successfully');
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || `Failed to ${mode} task`);
    } finally {
      setIsSubmitting(false);
    }
  }, [title, description, priority, status, dueDate, mode, leadId, taskId, user?.id, createTask, updateTask, onSuccess, onOpenChange]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!taskId) return;

    const confirmed = window.confirm(
      'Are you sure you want to delete this task? This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      await deleteTask(taskId);
      toast.success('Task deleted successfully');
      onDelete?.(taskId);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete task');
    } finally {
      setIsSubmitting(false);
    }
  }, [taskId, deleteTask, onDelete, onOpenChange]);

  const isViewMode = mode === 'view';

  const drawerTitle =
    mode === 'create'
      ? 'Create New Task'
      : mode === 'edit'
      ? 'Edit Task'
      : 'Task Details';

  const drawerDescription =
    mode !== 'create' && task
      ? `${task.priority} priority • ${task.status}`
      : undefined;

  const headerActions: DrawerHeaderAction[] =
    mode === 'view' && task
      ? [
          {
            icon: Pencil,
            onClick: handleSwitchToEdit,
            label: 'Edit task',
            variant: 'ghost',
          },
          {
            icon: Trash2,
            onClick: handleDelete,
            label: 'Delete task',
            variant: 'ghost',
          },
        ]
      : [];

  const footerButtons: DrawerActionButton[] =
    mode === 'view'
      ? [
          {
            label: 'Close',
            onClick: handleClose,
            variant: 'outline',
          },
        ]
      : mode === 'edit'
      ? [
          {
            label: 'Cancel',
            onClick: handleSwitchToView,
            variant: 'outline',
            disabled: isSubmitting,
          },
          {
            label: 'Save Changes',
            onClick: handleSubmit,
            variant: 'default',
            loading: isSubmitting,
          },
        ]
      : [
          {
            label: 'Cancel',
            onClick: handleClose,
            variant: 'outline',
            disabled: isSubmitting,
          },
          {
            label: 'Create Task',
            onClick: handleSubmit,
            variant: 'default',
            loading: isSubmitting,
          },
        ];

  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={drawerTitle}
      description={drawerDescription}
      mode={mode}
      headerActions={headerActions}
      isLoading={taskLoading && mode !== 'create'}
      loadingText="Loading task details..."
      size="md"
      footerButtons={footerButtons}
      footerAlignment="right"
      resizable={true}
      storageKey="task-drawer-width"
      onClose={handleClose}
    >
      <div className="space-y-5">
        {/* Task Details Section */}
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
            Task Details
          </h3>
          <div className="divide-y divide-border/40">
            {/* Title row */}
            <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2.5">
              <Label htmlFor="title" className="text-[13px] text-muted-foreground font-normal">
                Title <span className="text-destructive">*</span>
              </Label>
              {isViewMode ? (
                <span className="text-sm font-medium">{title || 'Untitled'}</span>
              ) : (
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={isSubmitting} placeholder="Enter task title..." className="h-9" />
              )}
            </div>

            {/* Priority row */}
            <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2.5">
              <Label htmlFor="priority" className="text-[13px] text-muted-foreground font-normal">Priority</Label>
              {isViewMode ? (
                <span className="text-sm font-medium">{priority}</span>
              ) : (
                <Select value={priority} onValueChange={(value) => setPriority(value as PriorityEnum)} disabled={isSubmitting}>
                  <SelectTrigger id="priority" className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Status row */}
            <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2.5">
              <Label htmlFor="status" className="text-[13px] text-muted-foreground font-normal">Status</Label>
              {isViewMode ? (
                <span className="text-sm font-medium">{status}</span>
              ) : (
                <Select value={status} onValueChange={(value) => setStatus(value as TaskStatusEnum)} disabled={isSubmitting}>
                  <SelectTrigger id="status" className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODO">To Do</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="DONE">Done</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Due Date row */}
            <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2.5">
              <Label htmlFor="dueDate" className="text-[13px] text-muted-foreground font-normal">Due Date</Label>
              {isViewMode ? (
                <span className="text-sm font-medium">{dueDate || 'Not set'}</span>
              ) : (
                <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={isSubmitting} className="h-9" />
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-border/50" />

        {/* Description Section */}
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
            Description
          </h3>
          {isViewMode ? (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{description || 'No description'}</p>
          ) : (
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={isSubmitting} placeholder="Enter task description..." rows={4} />
          )}
        </div>
      </div>
    </SideDrawer>
  );
};

export default TaskFormDrawer;
