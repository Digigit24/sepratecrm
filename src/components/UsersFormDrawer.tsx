// src/components/UsersFormDrawer.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pencil, Trash2, Phone, Mail } from 'lucide-react';
import { toast } from 'sonner';

import type { User, UserCreateData, UserUpdateData } from '@/types/user.types';
import { useUser } from '@/hooks/useUser';

import UserBasicInfo from './user-drawer/UserBasicInfo';
import { SideDrawer, type DrawerActionButton, type DrawerHeaderAction } from '@/components/SideDrawer';

// Form handle interface for collecting form values
export interface UserBasicInfoHandle {
  getFormValues: () => Promise<UserCreateData | UserUpdateData | null>;
}

interface UsersFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  mode: 'view' | 'edit' | 'create';
  onSuccess?: () => void;
  onDelete?: (id: string) => void;
  onModeChange?: (mode: 'view' | 'edit' | 'create') => void;
}

export default function UsersFormDrawer({
  open,
  onOpenChange,
  userId,
  mode,
  onSuccess,
  onDelete,
  onModeChange,
}: UsersFormDrawerProps) {
  const [activeTab, setActiveTab] = useState('basic');
  const [currentMode, setCurrentMode] = useState(mode);
  const [isSaving, setIsSaving] = useState(false);

  // Hooks
  const {
    useUserById,
    createUser,
    updateUser,
    deleteUser,
  } = useUser();

  const { data: user, isLoading: userLoading, mutate: revalidateUser } = useUserById(userId);

  // Form ref to collect values
  const formRef = useRef<UserBasicInfoHandle | null>(null);

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
      revalidateUser();
    }
    onSuccess?.();
  }, [currentMode, onSuccess, revalidateUser]);

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
    if (!userId) return;

    if (
      window.confirm(
        `Are you sure you want to delete ${user?.first_name} ${user?.last_name}? This action cannot be undone.`
      )
    ) {
      try {
        await deleteUser(userId);
        toast.success('User deleted successfully');
        onDelete?.(userId);
        handleClose();
      } catch (error: any) {
        toast.error(error?.message || 'Failed to delete user');
      }
    }
  }, [userId, user, deleteUser, onDelete, handleClose]);

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

        console.log('Creating user with values:', values);

        await createUser(values as UserCreateData);

        toast.success('User created successfully');
        handleSuccess();
        handleClose();
      } else if (currentMode === 'edit') {
        // EDIT FLOW
        const values = await formRef.current?.getFormValues();

        if (!values || !userId) {
          toast.error('Please fill in all required fields correctly');
          return;
        }

        console.log('Updating user with values:', values);

        await updateUser(userId, values as UserUpdateData);

        toast.success('User updated successfully');
        handleSuccess();
        handleSwitchToView();
      }
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error(
        error?.response?.data?.error ||
          error?.message ||
          'Failed to save user'
      );
    } finally {
      setIsSaving(false);
    }
  }, [currentMode, userId, createUser, updateUser, handleSuccess, handleClose, handleSwitchToView]);

  const drawerTitle =
    currentMode === 'create'
      ? 'Create New User'
      : user
      ? `${user.first_name} ${user.last_name}`
      : 'User Details';

  const drawerDescription =
    currentMode === 'create'
      ? undefined
      : user
      ? `${user.email} • ${user.roles.map(r => r.name).join(', ')}`
      : undefined;

  const headerActions: DrawerHeaderAction[] =
    currentMode === 'view' && user
      ? [
          {
            icon: Phone,
            onClick: () => {
              console.log('Call user');
              toast.info('Phone feature coming soon');
            },
            label: 'Call user',
            variant: 'ghost',
          },
          {
            icon: Mail,
            onClick: () => window.open(`mailto:${user.email}`, '_self'),
            label: 'Email user',
            variant: 'ghost',
          },
          {
            icon: Pencil,
            onClick: handleSwitchToEdit,
            label: 'Edit user',
            variant: 'ghost',
          },
          {
            icon: Trash2,
            onClick: handleDelete,
            label: 'Delete user',
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
            label: 'Create User',
            onClick: handleSave,
            variant: 'default',
            loading: isSaving,
          },
        ];

  const isLoading = userLoading;

  const drawerContent = (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="basic">User Information</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-6 space-y-6">
          <UserBasicInfo
            ref={formRef}
            user={user}
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
      loadingText="Loading user data..."
      size="lg"
      footerButtons={footerButtons}
      footerAlignment="right"
      showBackButton={true}
      resizable={true}
      storageKey="user-drawer-width"
      onClose={handleClose}
    >
      {drawerContent}
    </SideDrawer>
  );
}
