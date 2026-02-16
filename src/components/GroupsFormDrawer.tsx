// src/components/GroupsFormDrawer.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pencil, Trash2, MessageCircle, Users, UserPlus, UserMinus, Crown } from 'lucide-react';
import { toast } from 'sonner';

import type { Group, CreateGroupPayload, UpdateGroupPayload } from '@/types/whatsappTypes';
import { useGroup, useGroupMutations } from '@/hooks/whatsapp/useGroups';

import GroupBasicInfo from './group-drawer/GroupBasicInfo';
import { SideDrawer, type DrawerActionButton, type DrawerHeaderAction } from '@/components/SideDrawer';

// Form handle interface for collecting form values
export interface GroupBasicInfoHandle {
  /** Collects current form values with validation (async) for the drawer to submit */
  getFormValues: () => Promise<CreateGroupPayload | null>;
}

interface GroupsFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string | null;
  mode: 'view' | 'edit' | 'create';
  onSuccess?: () => void;
  onDelete?: (group_id: string) => void;
  onModeChange?: (mode: 'view' | 'edit' | 'create') => void;
}

export default function GroupsFormDrawer({
  open,
  onOpenChange,
  groupId,
  mode,
  onSuccess,
  onDelete,
  onModeChange,
}: GroupsFormDrawerProps) {
  const [activeTab, setActiveTab] = useState('basic');
  const [currentMode, setCurrentMode] = useState(mode);
  const [isSaving, setIsSaving] = useState(false);

  // Hooks
  const { group, isLoading, error, revalidate } = useGroup(groupId);
  const { createGroup, updateGroup, deleteGroup } = useGroupMutations();

  // Form ref to collect values
  const formRef = useRef<GroupBasicInfoHandle | null>(null);

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
      revalidate();
    }
    onSuccess?.();
  }, [currentMode, onSuccess, revalidate]);

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
    if (!groupId) return;

    if (
      window.confirm(
        'Are you sure you want to delete this group? This action cannot be undone.'
      )
    ) {
      try {
        await deleteGroup(groupId);
        toast.success('Group deleted successfully');
        onDelete?.(groupId);
        handleClose();
      } catch (error: any) {
        toast.error(error?.message || 'Failed to delete group');
      }
    }
  }, [groupId, deleteGroup, onDelete, handleClose]);

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

        console.log('Creating group with values:', values);

        await createGroup(values);

        toast.success('Group created successfully');
        handleSuccess();
        handleClose();
      } else if (currentMode === 'edit') {
        // EDIT FLOW
        const values = await formRef.current?.getFormValues();

        if (!values || !groupId) {
          toast.error('Please fill in all required fields correctly');
          return;
        }

        console.log('Updating group with values:', values);

        // Convert CreateGroupPayload to UpdateGroupPayload (exclude group_id)
        const { group_id, ...updatePayload } = values;
        await updateGroup(groupId, updatePayload as UpdateGroupPayload);

        toast.success('Group updated successfully');
        handleSuccess();
        handleSwitchToView();
      }
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error(
        error?.response?.data?.detail ||
          error?.message ||
          'Failed to save group'
      );
    } finally {
      setIsSaving(false);
    }
  }, [currentMode, groupId, createGroup, updateGroup, handleSuccess, handleClose, handleSwitchToView]);

  const drawerTitle =
    currentMode === 'create' ? 'Create New Group' : group?.name || 'Group Details';

  const drawerDescription =
    currentMode === 'create'
      ? undefined
      : group
      ? `ID: ${group.group_id} • ${group.participant_count} members`
      : undefined;

  const headerActions: DrawerHeaderAction[] =
    currentMode === 'view' && group
      ? [
          {
            icon: MessageCircle,
            onClick: () => {
              // Navigate to group chat
              console.log('Open group chat:', group.group_id);
            },
            label: 'Message group',
            variant: 'ghost',
          },
          {
            icon: UserPlus,
            onClick: () => {
              // Add participants
              console.log('Add participants to group:', group.group_id);
            },
            label: 'Add participants',
            variant: 'ghost',
          },
          {
            icon: Pencil,
            onClick: handleSwitchToEdit,
            label: 'Edit group',
            variant: 'ghost',
          },
          {
            icon: Trash2,
            onClick: handleDelete,
            label: 'Delete group',
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
            label: 'Create Group',
            onClick: handleSave,
            variant: 'default',
            loading: isSaving,
          },
        ];

  const drawerContent = (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="basic">Group Info</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-6 space-y-6">
          <GroupBasicInfo
            ref={formRef}
            group={group}
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
      loadingText="Loading group data..."
      size="lg"
      footerButtons={footerButtons}
      footerAlignment="right"
      showBackButton={true}
      resizable={true}
      storageKey="group-drawer-width"
      onClose={handleClose}
    >
      {drawerContent}
    </SideDrawer>
  );
}