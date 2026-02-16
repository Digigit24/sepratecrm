// src/components/RolesFormDrawer.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pencil, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';

import type { Role, RoleCreateData, RoleUpdateData } from '@/types/user.types';
import { useRoles } from '@/hooks/useRoles';

import RoleBasicInfo from './role-drawer/RoleBasicInfo';
import { SideDrawer, type DrawerActionButton, type DrawerHeaderAction } from '@/components/SideDrawer';

// Form handle interface for collecting form values
export interface RoleBasicInfoHandle {
  getFormValues: () => Promise<RoleCreateData | RoleUpdateData | null>;
}

interface RolesFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleId: string | null;
  mode: 'view' | 'edit' | 'create';
  onSuccess?: () => void;
  onDelete?: (id: string) => void;
  onModeChange?: (mode: 'view' | 'edit' | 'create') => void;
}

export default function RolesFormDrawer({
  open,
  onOpenChange,
  roleId,
  mode,
  onSuccess,
  onDelete,
  onModeChange,
}: RolesFormDrawerProps) {
  const [activeTab, setActiveTab] = useState('basic');
  const [currentMode, setCurrentMode] = useState(mode);
  const [isSaving, setIsSaving] = useState(false);

  // Hooks
  const {
    useRoleById,
    createRole,
    updateRole,
    deleteRole,
  } = useRoles();

  const { data: role, isLoading: roleLoading, mutate: revalidateRole } = useRoleById(roleId);

  // Form ref to collect values
  const formRef = useRef<RoleBasicInfoHandle | null>(null);

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
      revalidateRole();
    }
    onSuccess?.();
  }, [currentMode, onSuccess, revalidateRole]);

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
    if (!roleId) return;

    if (
      window.confirm(
        `Are you sure you want to delete "${role?.name}"? This action cannot be undone.`
      )
    ) {
      try {
        await deleteRole(roleId);
        toast.success('Role deleted successfully');
        onDelete?.(roleId);
        handleClose();
      } catch (error: any) {
        toast.error(error?.message || 'Failed to delete role');
      }
    }
  }, [roleId, role, deleteRole, onDelete, handleClose]);

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

        console.log('Creating role with values:', values);

        await createRole(values as RoleCreateData);

        toast.success('Role created successfully');
        handleSuccess();
        handleClose();
      } else if (currentMode === 'edit') {
        // EDIT FLOW
        const values = await formRef.current?.getFormValues();

        if (!values || !roleId) {
          toast.error('Please fill in all required fields correctly');
          return;
        }

        console.log('Updating role with values:', values);

        await updateRole(roleId, values as RoleUpdateData);

        toast.success('Role updated successfully');
        handleSuccess();
        handleSwitchToView();
      }
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error(
        error?.response?.data?.error ||
          error?.message ||
          'Failed to save role'
      );
    } finally {
      setIsSaving(false);
    }
  }, [currentMode, roleId, createRole, updateRole, handleSuccess, handleClose, handleSwitchToView]);

  const drawerTitle =
    currentMode === 'create'
      ? 'Create New Role'
      : role
      ? role.name
      : 'Role Details';

  const drawerDescription =
    currentMode === 'create'
      ? undefined
      : role
      ? `${role.member_count || 0} members • ${role.is_active ? 'Active' : 'Inactive'}`
      : undefined;

  const headerActions: DrawerHeaderAction[] =
    currentMode === 'view' && role
      ? [
          {
            icon: Users,
            onClick: () => {
              console.log('View role members');
              toast.info('Members view coming soon');
            },
            label: 'View members',
            variant: 'ghost',
          },
          {
            icon: Pencil,
            onClick: handleSwitchToEdit,
            label: 'Edit role',
            variant: 'ghost',
          },
          {
            icon: Trash2,
            onClick: handleDelete,
            label: 'Delete role',
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
            label: 'Create Role',
            onClick: handleSave,
            variant: 'default',
            loading: isSaving,
          },
        ];

  const isLoading = roleLoading;

  const drawerContent = (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="basic">Role Information</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-6 space-y-6">
          <RoleBasicInfo
            ref={formRef}
            role={role}
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
      loadingText="Loading role data..."
      size="lg"
      footerButtons={footerButtons}
      footerAlignment="right"
      showBackButton={true}
      resizable={true}
      storageKey="role-drawer-width"
      onClose={handleClose}
    >
      {drawerContent}
    </SideDrawer>
  );
}
