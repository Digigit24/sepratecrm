// src/components/TaskFormDrawer.tsx
//
// THE task drawer. There is exactly one.
//
// This used to be two components that did the same job and had drifted apart:
//   - TaskFormDrawer  (lead-scoped, sent owner_user_id, no reporter field)
//   - TasksFormDrawer (+ task-drawer/TaskBasicInfo: react-hook-form + zod,
//                      required a lead, had a reporter field and a metadata
//                      card, and a "Calendar" header button that only ever
//                      toasted "coming soon")
// Two forms meant two payload shapes for one endpoint. They are now one: this
// drawer renders the shared <TaskFormFields>, which the persistent side panel
// on /crm/tasks also renders, so the edit surface cannot fork again.
//
// Call sites: lead-drawer/LeadTasks, lead-drawer/LeadTasksBlock (both pass
// `leadId`, which pins the link and hides the record picker) and the tasks page
// (no `leadId` -- a CRM-wide task may link to a Lead, Project, Unit, Meeting,
// or nothing at all).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { SideDrawer, type DrawerActionButton, type DrawerHeaderAction } from '@/components/SideDrawer';
import { TaskFormFields } from '@/components/tasks/TaskFormFields';
import {
  draftFromTask,
  draftToPayload,
  emptyDraft,
  validateDraft,
  type TaskDraft,
} from '@/components/tasks/taskDraft';
import type { CreateTaskPayload, UpdateTaskPayload } from '@/types/crmTypes';

export interface TaskFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId?: number | null;
  /** When set, the task is pinned to this lead and the link picker is hidden. */
  leadId?: number | null;
  mode: 'view' | 'edit' | 'create';
  onSuccess?: () => void;
  onDelete?: (id: number) => void;
  onModeChange?: (mode: 'view' | 'edit' | 'create') => void;
  defaultAssignedTo?: string | null;
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
  defaultAssignedTo,
}) => {
  const { useTask, createTask, updateTask, deleteTask } = useCRM();

  const [draft, setDraft] = useState<TaskDraft>(() => emptyDraft());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: task, isLoading: taskLoading, mutate: revalidateTask } = useTask(
    mode !== 'create' && taskId ? taskId : null
  );

  const baseDraft = useMemo<TaskDraft>(() => {
    if (mode === 'create') {
      return emptyDraft({
        assigneeUserId: defaultAssignedTo || '',
        relatedType: leadId ? 'LEAD' : 'NONE',
        relatedId: leadId ?? null,
      });
    }
    return task ? draftFromTask(task) : emptyDraft();
  }, [task, mode, defaultAssignedTo, leadId]);

  // Reset whenever the drawer opens on a different task, or the mode flips.
  useEffect(() => {
    setDraft(baseDraft);
  }, [baseDraft, open]);

  const patchDraft = useCallback((patch: Partial<TaskDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);

  const handleSwitchToEdit = useCallback(() => onModeChange?.('edit'), [onModeChange]);

  const handleSwitchToView = useCallback(() => {
    setDraft(baseDraft);
    onModeChange?.('view');
  }, [baseDraft, onModeChange]);

  const handleSubmit = useCallback(async () => {
    const problem = validateDraft(draft);
    if (problem) {
      toast.error(problem);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = draftToPayload(draft);
      // A lead-scoped drawer always writes the lead, whatever the draft says.
      if (leadId) payload.lead = leadId;

      if (mode === 'create') {
        await createTask(payload as CreateTaskPayload);
        toast.success('Task created');
      } else if (taskId) {
        await updateTask(taskId, payload as UpdateTaskPayload);
        toast.success('Task updated');
        revalidateTask();
      }

      onSuccess?.();
      if (mode === 'create') onOpenChange(false);
      else onModeChange?.('view');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : `Failed to ${mode === 'create' ? 'create' : 'update'} task`
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    draft,
    leadId,
    mode,
    taskId,
    createTask,
    updateTask,
    revalidateTask,
    onSuccess,
    onOpenChange,
    onModeChange,
  ]);

  const handleDelete = useCallback(async () => {
    if (!taskId) return;
    const confirmed = window.confirm(
      'Delete this task? This cannot be undone.'
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      await deleteTask(taskId);
      toast.success('Task deleted');
      onDelete?.(taskId);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete task');
    } finally {
      setIsSubmitting(false);
    }
  }, [taskId, deleteTask, onDelete, onOpenChange]);

  const drawerTitle =
    mode === 'create' ? 'New task' : mode === 'edit' ? 'Edit task' : task?.title || 'Task';

  const drawerDescription =
    mode !== 'create' && task
      ? [task.priority, task.status, task.related_label || task.lead_name]
          .filter(Boolean)
          .join(' • ')
      : undefined;

  const headerActions: DrawerHeaderAction[] =
    mode === 'view' && task
      ? [
          { icon: Pencil, onClick: handleSwitchToEdit, label: 'Edit task', variant: 'ghost' },
          { icon: Trash2, onClick: handleDelete, label: 'Delete task', variant: 'ghost' },
        ]
      : [];

  const footerButtons: DrawerActionButton[] =
    mode === 'view'
      ? [{ label: 'Close', onClick: handleClose, variant: 'outline' }]
      : [
          {
            label: 'Cancel',
            onClick: mode === 'edit' ? handleSwitchToView : handleClose,
            variant: 'outline',
            disabled: isSubmitting,
          },
          {
            label: mode === 'create' ? 'Create task' : 'Save changes',
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
      loadingText="Loading task..."
      size="md"
      footerButtons={footerButtons}
      footerAlignment="right"
      resizable
      storageKey="task-drawer-width"
      onClose={handleClose}
    >
      <TaskFormFields
        draft={draft}
        onChange={patchDraft}
        readOnly={mode === 'view'}
        disabled={isSubmitting}
        lockedToLeadId={leadId ?? null}
        relatedLabel={task?.related_label ?? task?.lead_name ?? null}
      />
    </SideDrawer>
  );
};

export default TaskFormDrawer;
