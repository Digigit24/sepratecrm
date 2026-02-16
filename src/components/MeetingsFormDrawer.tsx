// src/components/MeetingsFormDrawer.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pencil, Trash2, Calendar, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

import type { Meeting, MeetingCreateData, MeetingUpdateData } from '@/types/meeting.types';
import { useMeeting } from '@/hooks/useMeeting';

import MeetingBasicInfo from './meeting-drawer/MeetingBasicInfo';
import { SideDrawer, type DrawerActionButton, type DrawerHeaderAction } from '@/components/SideDrawer';
import { format } from 'date-fns';

// Form handle interface for collecting form values
export interface MeetingBasicInfoHandle {
  getFormValues: () => Promise<MeetingCreateData | MeetingUpdateData | null>;
}

interface MeetingsFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: number | null;
  mode: 'view' | 'edit' | 'create';
  onSuccess?: () => void;
  onDelete?: (id: number) => void;
  onModeChange?: (mode: 'view' | 'edit' | 'create') => void;
  initialLeadId?: number | null;
}

export default function MeetingsFormDrawer({
  open,
  onOpenChange,
  meetingId,
  mode,
  onSuccess,
  onDelete,
  onModeChange,
  initialLeadId,
}: MeetingsFormDrawerProps) {
  const [activeTab, setActiveTab] = useState('basic');
  const [currentMode, setCurrentMode] = useState(mode);
  const [isSaving, setIsSaving] = useState(false);

  // Hooks
  const {
    useMeeting: useMeetingById,
    createMeeting,
    updateMeeting,
    deleteMeeting,
  } = useMeeting();

  const { data: meeting, isLoading: meetingLoading, mutate: revalidateMeeting } = useMeetingById(meetingId);

  // Form ref to collect values
  const formRef = useRef<MeetingBasicInfoHandle | null>(null);

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
      revalidateMeeting();
    }
    onSuccess?.();
  }, [currentMode, onSuccess, revalidateMeeting]);

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
    if (!meetingId) return;

    if (
      window.confirm(
        `Are you sure you want to delete the meeting "${meeting?.title}"? This action cannot be undone.`
      )
    ) {
      try {
        await deleteMeeting(meetingId);
        toast.success('Meeting deleted successfully');
        onDelete?.(meetingId);
        handleClose();
      } catch (error: any) {
        toast.error(error?.message || 'Failed to delete meeting');
      }
    }
  }, [meetingId, meeting, deleteMeeting, onDelete, handleClose]);

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

        console.log('Creating meeting with values:', values);

        await createMeeting(values as MeetingCreateData);

        toast.success('Meeting created successfully');
        handleSuccess();
        handleClose();
      } else if (currentMode === 'edit') {
        // EDIT FLOW
        const values = await formRef.current?.getFormValues();

        if (!values || !meetingId) {
          toast.error('Please fill in all required fields correctly');
          return;
        }

        console.log('Updating meeting with values:', values);

        await updateMeeting(meetingId, values as MeetingUpdateData);

        toast.success('Meeting updated successfully');
        handleSuccess();
        handleSwitchToView();
      }
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error(
        error?.response?.data?.error ||
          error?.message ||
          'Failed to save meeting'
      );
    } finally {
      setIsSaving(false);
    }
  }, [currentMode, meetingId, createMeeting, updateMeeting, handleSuccess, handleClose, handleSwitchToView]);

  // Format meeting time for subtitle
  const formatMeetingTime = (meeting: Meeting | null | undefined) => {
    if (!meeting) return undefined;
    try {
      const startTime = format(new Date(meeting.start_at), 'PPp');
      return `${startTime} • ${meeting.lead_name || 'No lead'}`;
    } catch {
      return meeting.lead_name || 'No lead';
    }
  };

  const drawerTitle =
    currentMode === 'create'
      ? 'Create New Meeting'
      : meeting
      ? meeting.title
      : 'Meeting Details';

  const drawerDescription =
    currentMode === 'create'
      ? undefined
      : formatMeetingTime(meeting);

  const headerActions: DrawerHeaderAction[] =
    currentMode === 'view' && meeting
      ? [
          {
            icon: Pencil,
            onClick: handleSwitchToEdit,
            label: 'Edit meeting',
            variant: 'ghost',
          },
          {
            icon: Trash2,
            onClick: handleDelete,
            label: 'Delete meeting',
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
            label: 'Create Meeting',
            onClick: handleSave,
            variant: 'default',
            loading: isSaving,
          },
        ];

  const isLoading = meetingLoading;

  const drawerContent = (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="basic">Meeting Information</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-6">
          <MeetingBasicInfo
            ref={formRef}
            meeting={meeting}
            mode={currentMode}
            onSuccess={handleSuccess}
            initialLeadId={initialLeadId}
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
      loadingText="Loading meeting details..."
      size="lg"
      footerButtons={footerButtons}
      footerAlignment="right"
      resizable={true}
      storageKey="meeting-drawer-width"
      onClose={handleClose}
    >
      {drawerContent}
    </SideDrawer>
  );
}
