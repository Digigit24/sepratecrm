// src/components/TasksFormDrawer.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pencil, Trash2, Calendar } from 'lucide-react';
import { toast } from 'sonner';

import type { Task, CreateTaskPayload, UpdateTaskPayload } from '@/types/crmTypes';
import { useCRM } from '@/hooks/useCRM';

import TaskBasicInfo from './task-drawer/TaskBasicInfo';
import { SideDrawer, type DrawerActionButton, type DrawerHeaderAction } from '@/components/SideDrawer';

// Form handle interface for collecting form values
export interface TaskBasicInfoHandle {
  getFormValues: () => Promise<CreateTaskPayload | UpdateTaskPayload | null>;
}

interface TasksFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: number | null;
  mode: 'view' | 'edit' | 'create';
  onSuccess?: () => void;
  onDelete?: (id: number) => void;
  onModeChange?: (mode: 'view' | 'edit' | 'create') => void;
}

export default function TasksFormDrawer({
  open,
  onOpenChange,
  taskId,
  mode,
  onSuccess,
  onDelete,
  onModeChange,
}: TasksFormDrawerProps) {
  const [activeTab, setActiveTab] = useState('basic');
  const [currentMode, setCurrentMode] = useState(mode);
  const [isSaving, setIsSaving] = useState(false);

  // Hooks
  const {
    useTask,
    useLeads,
    createTask,
    updateTask,
    deleteTask,
  } = useCRM();

  const { data: task, isLoading: taskLoading, mutate: revalidateTask } = useTask(taskId);
  const { data: leadsData, isLoading: leadsLoading } = useLeads({ page_size: 100 });

  // Form ref to collect values
  const formRef = useRef<TaskBasicInfoHandle | null>(null);

  // Sync internal mode with prop
  useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

  // Reset tab when opening
  useEffect(() => {
    if (open) {
      setActiveTab('basic');
    }
  }, [open]);

  const handleSuccess = useCallback(() => {
    if (currentMode !== 'create') {
      revalidateTask();
    }
    onSuccess?.();
  }, [currentMode, onSuccess, revalidateTask]);

  const handleClose = useCallback(() => {
    setActiveTab('basic');
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSwitchToEdit = useCallback(() => {
    setCurrentMode('edit');
    onModeChange?.('edit');
  }, [onModeChange]);

  const handleSwitchToView = useCallback(() => {
    setCurrentMode('view');
    onModeChange?.('view');
  }, [onModeChange]);

  const handleDelete = useCallback(async () => {
    if (!taskId) return;

    if (
      window.confirm(
        `Are you sure you want to delete task "${task?.title}"? This action cannot be undone.`
      )
    ) {
      try {
        await deleteTask(taskId);
        toast.success('Task deleted successfully');
        onDelete?.(taskId);
        handleClose();
      } catch (error: any) {
        toast.error(error?.message || 'Failed to delete task');
      }
    }
  }, [taskId, task, deleteTask, onDelete, handleClose]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      if (currentMode === 'create') {
        // CREATE FLOW
        const values = await formRef.current?.getFormValues();

        if (!values) {
          toast.error('Please fill in all required fields correctly');
          return;
        }

        console.log('Creating task with values:', values);

        await createTask(values as CreateTaskPayload);

        toast.success('Task created successfully');
        handleSuccess();
        handleClose();
      } else if (currentMode === 'edit') {
        // EDIT FLOW
        const values = await formRef.current?.getFormValues();

        if (!values || !taskId) {
          toast.error('Please fill in all required fields correctly');
          return;
        }

        console.log('Updating task with values:', values);

        await updateTask(taskId, values as UpdateTaskPayload);

        toast.success('Task updated successfully');
        handleSuccess();
        handleSwitchToView();
      }
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error(
        error?.response?.data?.error ||
          error?.message ||
          'Failed to save task'
      );
    } finally {
      setIsSaving(false);
    }
  }, [currentMode, taskId, createTask, updateTask, handleSuccess, handleClose, handleSwitchToView]);

  const drawerTitle =
    currentMode === 'create'
      ? 'Create New Task'
      : task
      ? task.title
      : 'Task Details';

  const drawerDescription =
    currentMode === 'create'
      ? undefined
      : task
      ? task.lead_name || `Task #${task.id}`
      : undefined;

  const headerActions: DrawerHeaderAction[] =
    currentMode === 'view' && task
      ? [
          {
            icon: Calendar,
            onClick: () => {
              console.log('View calendar');
              toast.info('Calendar feature coming soon');
            },
            label: 'View calendar',
            variant: 'ghost',
          },
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
    currentMode === 'view'
      ? [
          {
            label: 'Close',
            onClick: handleClose,
            variant: 'outline',
          },
        ]
      : currentMode === 'edit'
      ? [
          {
            label: 'Cancel',
            onClick: handleSwitchToView,
            variant: 'outline',
            disabled: isSaving,
          },
          {
            label: 'Save Changes',
            onClick: handleSave,
            variant: 'default',
            loading: isSaving,
          },
        ]
      : [
          {
            label: 'Cancel',
            onClick: handleClose,
            variant: 'outline',
            disabled: isSaving,
          },
          {
            label: 'Create Task',
            onClick: handleSave,
            variant: 'default',
            loading: isSaving,
          },
        ];

  const isLoading = taskLoading || leadsLoading;
  const leads = leadsData?.results || [];

  const drawerContent = (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="basic">Task Information</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-6 space-y-6">
          <TaskBasicInfo
            ref={formRef}
            task={task}
            leads={leads}
            mode={currentMode}
            onSuccess={handleSuccess}
          />
        </TabsContent>
      </Tabs>
    </div>
  );

  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={drawerTitle}
      description={drawerDescription}
      mode={currentMode}
      headerActions={headerActions}
      isLoading={isLoading}
      loadingText="Loading task data..."
      size="lg"
      footerButtons={footerButtons}
      footerAlignment="right"
      showBackButton={true}
      resizable={true}
      storageKey="task-drawer-width"
      onClose={handleClose}
    >
      {drawerContent}
    </SideDrawer>
  );
}
