// src/components/ActivitiesFormDrawer.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { Pencil, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

import type { LeadActivity, CreateLeadActivityPayload, UpdateLeadActivityPayload } from '@/types/crmTypes';
import { useCRM } from '@/hooks/useCRM';

import ActivityInfo from './activity-drawer/ActivityInfo';
import { SideDrawer, type DrawerActionButton, type DrawerHeaderAction } from '@/components/SideDrawer';

// Form handle interface for collecting form values
export interface ActivityFormHandle {
  /** Collects current form values with validation (async) for the drawer to submit */
  getFormValues: () => Promise<CreateLeadActivityPayload | null>;
}

interface ActivitiesFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityId: number | null;
  mode: 'view' | 'edit' | 'create';
  onSuccess?: () => void;
  onDelete?: (id: number) => void;
  onModeChange?: (mode: 'view' | 'edit' | 'create') => void;
}

export function ActivitiesFormDrawer({
  open,
  onOpenChange,
  activityId,
  mode,
  onSuccess,
  onDelete,
  onModeChange,
}: ActivitiesFormDrawerProps) {
  const [currentMode, setCurrentMode] = useState(mode);
  const [isSaving, setIsSaving] = useState(false);

  // Hooks
  const { useLeadActivities, createLeadActivity, updateLeadActivity, deleteLeadActivity } = useCRM();
  
  // Fetch single activity - we need to use the list endpoint with filter
  const { data: activitiesData, isLoading, mutate: revalidate } = useLeadActivities(
    activityId ? { page: 1, page_size: 1 } : undefined
  );
  
  const activity = activitiesData?.results.find(a => a.id === activityId) || null;

  // Form ref to collect values
  const formRef = useRef<ActivityFormHandle | null>(null);

  // Sync internal mode with prop
  useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

  const handleSuccess = useCallback(() => {
    if (currentMode !== 'create') {
      revalidate();
    }
    onSuccess?.();
  }, [currentMode, onSuccess, revalidate]);

  const handleClose = useCallback(() => {
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
    if (!activityId) return;

    if (
      window.confirm(
        'Are you sure you want to delete this activity? This action cannot be undone.'
      )
    ) {
      try {
        await deleteLeadActivity(activityId);
        toast.success('Activity deleted successfully');
        onDelete?.(activityId);
        handleClose();
      } catch (error: any) {
        toast.error(error?.message || 'Failed to delete activity');
      }
    }
  }, [activityId, deleteLeadActivity, onDelete, handleClose]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const values = await formRef.current?.getFormValues();

      if (!values) {
        toast.error('Please fill in all required fields correctly');
        return;
      }

      console.log('Form values:', values);

      if (currentMode === 'create') {
        // CREATE FLOW
        await createLeadActivity(values);
        toast.success('Activity created successfully');
        handleSuccess();
        handleClose();
      } else if (currentMode === 'edit') {
        // EDIT FLOW
        if (!activityId) {
          toast.error('Activity ID is missing');
          return;
        }

        await updateLeadActivity(activityId, values as UpdateLeadActivityPayload);
        toast.success('Activity updated successfully');
        handleSuccess();
        handleSwitchToView();
      }
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error(
        error?.response?.data?.detail ||
          error?.message ||
          'Failed to save activity'
      );
    } finally {
      setIsSaving(false);
    }
  }, [currentMode, activityId, createLeadActivity, updateLeadActivity, handleSuccess, handleClose, handleSwitchToView]);

  const drawerTitle =
    currentMode === 'create'
      ? 'Create New Activity'
      : activity
      ? `${activity.type} Activity`
      : 'Activity Details';

  const drawerDescription =
    currentMode === 'create'
      ? undefined
      : activity
      ? `Lead #${activity.lead} • ${new Date(activity.happened_at).toLocaleDateString()}`
      : undefined;

  const headerActions: DrawerHeaderAction[] =
    currentMode === 'view' && activity
      ? [
          ...(activity.file_url
            ? [
                {
                  icon: ExternalLink as React.ComponentType<{ className?: string }>,
                  onClick: () => window.open(activity.file_url, '_blank'),
                  label: 'Open attachment',
                  variant: 'ghost' as const,
                },
              ]
            : []),
          {
            icon: Pencil,
            onClick: handleSwitchToEdit,
            label: 'Edit activity',
            variant: 'ghost',
          },
          {
            icon: Trash2,
            onClick: handleDelete,
            label: 'Delete activity',
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
            label: 'Create Activity',
            onClick: handleSave,
            variant: 'default',
            loading: isSaving,
          },
        ];

  const drawerContent = (
    <div className="space-y-6">
      <ActivityInfo
        ref={formRef}
        activity={activity}
        mode={currentMode}
        onSuccess={handleSuccess}
      />
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
      isLoading={isLoading && currentMode !== 'create'}
      loadingText="Loading activity data..."
      size="lg"
      footerButtons={footerButtons}
      footerAlignment="right"
      showBackButton={true}
      resizable={true}
      storageKey="activity-drawer-width"
      onClose={handleClose}
    >
      {drawerContent}
    </SideDrawer>
  );
}