// src/components/LeadsFormDrawer.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pencil, Trash2, Phone, Mail, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

import type { Lead, CreateLeadPayload, UpdateLeadPayload } from '@/types/crmTypes';
import { useCRM } from '@/hooks/useCRM';

import LeadDetailsForm from './lead-drawer/LeadDetailsForm';
import LeadActivities from './lead-drawer/LeadActivities';
import { LeadTasks } from './lead-drawer/LeadTasks';
import { LeadMeetings } from './lead-drawer/LeadMeetings';
import { SideDrawer, type DrawerActionButton, type DrawerHeaderAction } from '@/components/SideDrawer';

// Form handle interface for collecting form values
export interface LeadFormHandle {
  /** Collects current form values with validation (async) for the drawer to submit */
  getFormValues: () => Promise<CreateLeadPayload | null>;
}

export interface PartialLeadFormHandle {
  /** Collects partial form values (for optional sections like address) */
  getFormValues: () => Promise<Partial<CreateLeadPayload> | null>;
}


interface LeadsFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: number | null;
  mode: 'view' | 'edit' | 'create';
  onSuccess?: () => void;
  onDelete?: (id: number) => void;
  onModeChange?: (mode: 'view' | 'edit' | 'create') => void;
}

export function LeadsFormDrawer({
  open,
  onOpenChange,
  leadId,
  mode,
  onSuccess,
  onDelete,
  onModeChange,
}: LeadsFormDrawerProps) {
  const [activeTab, setActiveTab] = useState('details');
  const [currentMode, setCurrentMode] = useState(mode);
  const [isSaving, setIsSaving] = useState(false);

  // Hooks
  const { useLead, createLead, updateLead, deleteLead } = useCRM();
  const { data: lead, isLoading, error, mutate: revalidate } = useLead(leadId);

  // Form ref - unified form for all lead data
  const detailsFormRef = useRef<LeadFormHandle | null>(null);

  // Sync internal mode with prop
  useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

  // Reset tab when opening
  useEffect(() => {
    if (open) {
      setActiveTab('details');
    }
  }, [open]);

  const handleSuccess = useCallback(() => {
    if (currentMode !== 'create') {
      revalidate();
    }
    onSuccess?.();
  }, [currentMode, onSuccess, revalidate]);

  const handleClose = useCallback(() => {
    setActiveTab('details');
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
    if (!leadId) return;

    if (
      window.confirm(
        `Are you sure you want to delete "${lead?.name}"? This action cannot be undone.`
      )
    ) {
      try {
        await deleteLead(leadId);
        toast.success('Lead deleted successfully');
        onDelete?.(leadId);
        handleClose();
      } catch (error: any) {
        toast.error(error?.message || 'Failed to delete lead');
      }
    }
  }, [leadId, lead, deleteLead, onDelete, handleClose]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // Collect all form values from unified form
      const formValues = await detailsFormRef.current?.getFormValues();

      if (!formValues) {
        toast.error('Please fill in all required fields correctly');
        setActiveTab('details');
        setIsSaving(false);
        return;
      }

      console.log('Form values:', formValues);

      if (currentMode === 'create') {
        // CREATE FLOW
        await createLead(formValues);
        toast.success('Lead created successfully');
        handleSuccess();
        handleClose();
      } else if (currentMode === 'edit') {
        // EDIT FLOW
        if (!leadId) {
          toast.error('Lead ID is missing');
          setIsSaving(false);
          return;
        }

        await updateLead(leadId, formValues as UpdateLeadPayload);
        toast.success('Lead updated successfully');
        handleSuccess();
        handleSwitchToView();
      }
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error(
        error?.response?.data?.detail ||
          error?.message ||
          'Failed to save lead'
      );
    } finally {
      setIsSaving(false);
    }
  }, [currentMode, leadId, createLead, updateLead, handleSuccess, handleClose, handleSwitchToView]);

  const drawerTitle =
    currentMode === 'create'
      ? 'Create New Lead'
      : lead?.name || 'Lead Details';

  const drawerDescription =
    currentMode === 'create'
      ? undefined
      : lead
      ? `${lead.phone}${lead.company ? ` • ${lead.company}` : ''}`
      : undefined;

  const handleWhatsApp = useCallback(() => {
    if (!lead?.phone) {
      toast.error('No phone number available');
      return;
    }

    // Format phone number for WhatsApp (remove all non-digits except +)
    let cleanPhone = lead.phone.replace(/[^\d+]/g, '');

    // Remove leading + if present for WhatsApp API
    if (cleanPhone.startsWith('+')) {
      cleanPhone = cleanPhone.substring(1);
    }

    // Create pre-filled message
    const message = `Hi ${lead.name}, I'm reaching out regarding your inquiry.`;
    const encodedMessage = encodeURIComponent(message);

    // Open WhatsApp with pre-filled message
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');

    toast.success(`Opening WhatsApp for ${lead.name}...`, {
      description: lead.phone,
      duration: 2000,
    });
  }, [lead]);

  const headerActions: DrawerHeaderAction[] =
    currentMode === 'view' && lead
      ? [
          {
            icon: Phone,
            onClick: () => window.open(`tel:${lead.phone}`, '_self'),
            label: 'Call lead',
            variant: 'ghost',
          },
          {
            icon: MessageCircle,
            onClick: handleWhatsApp,
            label: 'WhatsApp',
            variant: 'ghost',
          },
          ...(lead.email
            ? [
                {
                  icon: Mail as React.ComponentType<{ className?: string }>,
                  onClick: () => window.open(`mailto:${lead.email}`, '_self'),
                  label: 'Email lead',
                  variant: 'ghost' as const,
                },
              ]
            : []),
          {
            icon: Pencil,
            onClick: handleSwitchToEdit,
            label: 'Edit lead',
            variant: 'ghost',
          },
          {
            icon: Trash2,
            onClick: handleDelete,
            label: 'Delete lead',
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
            label: 'Create Lead',
            onClick: handleSave,
            variant: 'default',
            loading: isSaving,
          },
        ];

  const drawerContent = (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="activities" disabled={currentMode === 'create'}>
            Activities
          </TabsTrigger>
          <TabsTrigger value="tasks" disabled={currentMode === 'create'}>
            Tasks
          </TabsTrigger>
          <TabsTrigger value="meetings" disabled={currentMode === 'create'}>
            Meetings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-6 space-y-6">
          <LeadDetailsForm ref={detailsFormRef} lead={lead} mode={currentMode} />
        </TabsContent>

        <TabsContent value="activities" className="mt-6 space-y-6">
          {leadId && <LeadActivities leadId={leadId} />}
        </TabsContent>

        <TabsContent value="tasks" className="mt-6 space-y-6">
          {leadId && <LeadTasks leadId={leadId} />}
        </TabsContent>

        <TabsContent value="meetings" className="mt-6 space-y-6">
          {leadId && <LeadMeetings leadId={leadId} />}
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
      loadingText="Loading lead data..."
      size="lg"
      footerButtons={footerButtons}
      footerAlignment="right"
      showBackButton={true}
      resizable={true}
      storageKey="lead-drawer-width"
      onClose={handleClose}
    >
      {drawerContent}
    </SideDrawer>
  );
}
