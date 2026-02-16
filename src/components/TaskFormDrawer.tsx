// src/components/TaskFormDrawer.tsx
import { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
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
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Task, TaskStatusEnum, PriorityEnum } from '@/types/crmTypes';

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
  const [isDeleting, setIsDeleting] = useState(false);

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
      // Reset form for create mode
      setTitle('');
      setDescription('');
      setPriority('MEDIUM');
      setStatus('TODO');
      setDueDate('');
    }
  }, [task, mode]);

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
  };

  // Handle delete
  const handleDelete = async () => {
    if (!taskId) return;

    const confirmed = window.confirm(
      'Are you sure you want to delete this task? This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      setIsDeleting(true);
      await deleteTask(taskId);
      toast.success('Task deleted successfully');
      onDelete?.(taskId);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete task');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle mode change
  const handleEdit = () => {
    onModeChange?.('edit');
  };

  const handleCancelEdit = () => {
    onModeChange?.('view');
    // Reset form to original values
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setPriority(task.priority || 'MEDIUM');
      setStatus(task.status || 'TODO');
      setDueDate(task.due_date ? task.due_date.split('T')[0] : '');
    }
  };

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isCreateMode = mode === 'create';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isCreateMode && 'Create New Task'}
            {isViewMode && 'Task Details'}
            {isEditMode && 'Edit Task'}
          </SheetTitle>
          <SheetDescription>
            {isCreateMode && 'Add a new task for this lead'}
            {isViewMode && 'View task details'}
            {isEditMode && 'Update task information'}
          </SheetDescription>
        </SheetHeader>

        {taskLoading && !isCreateMode ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 mt-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isViewMode || isSubmitting}
                placeholder="Enter task title..."
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isViewMode || isSubmitting}
                placeholder="Enter task description..."
                rows={4}
              />
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as PriorityEnum)}
                disabled={isViewMode || isSubmitting}
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as TaskStatusEnum)}
                disabled={isViewMode || isSubmitting}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODO">To Do</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="DONE">Done</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={isViewMode || isSubmitting}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              {isViewMode && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handleEdit}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Delete'
                    )}
                  </Button>
                </>
              )}

              {isEditMode && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handleCancelEdit}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </>
              )}

              {isCreateMode && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => onOpenChange(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Task'
                    )}
                  </Button>
                </>
              )}
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default TaskFormDrawer;
