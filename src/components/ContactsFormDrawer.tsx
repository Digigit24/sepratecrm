// src/components/ContactsFormDrawer.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pencil, Trash2, Phone, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

import type { Contact, CreateContactPayload, UpdateContactPayload } from '@/types/whatsappTypes';
import { useContact, useContactMutations } from '@/hooks/whatsapp/useContacts';

import ContactBasicInfo from './contact-drawer/ContactBasicInfo';
import { SideDrawer, type DrawerActionButton, type DrawerHeaderAction } from '@/components/SideDrawer';

// Form handle interface for collecting form values
export interface ContactBasicInfoHandle {
  /** Collects current form values with validation (async) for the drawer to submit */
  getFormValues: () => Promise<CreateContactPayload | null>;
}

interface ContactsFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactPhone: string | null;
  mode: 'view' | 'edit' | 'create';
  onSuccess?: () => void;
  onDelete?: (phone: string) => void;
  onModeChange?: (mode: 'view' | 'edit' | 'create') => void;
}

export default function ContactsFormDrawer({
  open,
  onOpenChange,
  contactPhone,
  mode,
  onSuccess,
  onDelete,
  onModeChange,
}: ContactsFormDrawerProps) {
  const [activeTab, setActiveTab] = useState('basic');
  const [currentMode, setCurrentMode] = useState(mode);
  const [isSaving, setIsSaving] = useState(false);

  // Hooks
  const { contact, isLoading, error, revalidate } = useContact(contactPhone);
  const { createContact, updateContact, deleteContact } = useContactMutations();

  // Form ref to collect values
  const formRef = useRef<ContactBasicInfoHandle | null>(null);

  // Ensure we fetch latest detail when opening a contact
  useEffect(() => {
    if (open && contactPhone) {
      revalidate();
    }
  }, [open, contactPhone, revalidate]);

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
    if (!contactPhone) return;

    if (
      window.confirm(
        'Are you sure you want to delete this contact? This action cannot be undone.'
      )
    ) {
      try {
        await deleteContact(contactPhone);
        toast.success('Contact deleted successfully');
        onDelete?.(contactPhone);
        handleClose();
      } catch (error: any) {
        toast.error(error?.message || 'Failed to delete contact');
      }
    }
  }, [contactPhone, deleteContact, onDelete, handleClose]);

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

        console.log('Creating contact with values:', values);

        await createContact(values);

        toast.success('Contact created successfully');
        handleSuccess();
        handleClose();
      } else if (currentMode === 'edit') {
        // EDIT FLOW
        const values = await formRef.current?.getFormValues();

        if (!values || !contactPhone) {
          toast.error('Please fill in all required fields correctly');
          return;
        }

        console.log('Updating contact with values:', values);

        // Convert CreateContactPayload to UpdateContactPayload (exclude phone)
        const { phone, ...updatePayload } = values;
        await updateContact(contactPhone, updatePayload as UpdateContactPayload);

        toast.success('Contact updated successfully');
        handleSuccess();
        handleSwitchToView();
      }
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error(
        error?.response?.data?.detail ||
          error?.message ||
          'Failed to save contact'
      );
    } finally {
      setIsSaving(false);
    }
  }, [currentMode, contactPhone, createContact, updateContact, handleSuccess, handleClose, handleSwitchToView]);

  const drawerTitle =
    currentMode === 'create' ? 'Create New Contact' : contact?.name || contact?.phone || 'Contact Details';

  const drawerDescription =
    currentMode === 'create'
      ? undefined
      : contact
      ? `Phone: ${contact.phone}${contact.is_business ? ' • Business' : ''}`
      : undefined;

  const headerActions: DrawerHeaderAction[] =
    currentMode === 'view' && contact
      ? [
          {
            icon: Phone,
            onClick: () => window.open(`tel:${contact.phone}`, '_self'),
            label: 'Call contact',
            variant: 'ghost',
          },
          {
            icon: MessageCircle,
            onClick: () => {
              // Navigate to chat with this contact
              console.log('Open chat with:', contact.phone);
            },
            label: 'Message contact',
            variant: 'ghost',
          },
          {
            icon: Pencil,
            onClick: handleSwitchToEdit,
            label: 'Edit contact',
            variant: 'ghost',
          },
          {
            icon: Trash2,
            onClick: handleDelete,
            label: 'Delete contact',
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
            label: 'Create Contact',
            onClick: handleSave,
            variant: 'default',
            loading: isSaving,
          },
        ];

  const drawerContent = (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="basic">Contact Info</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-6 space-y-6">
          <ContactBasicInfo
            key={`${contactPhone || 'new'}-${currentMode}`}
            ref={formRef}
            contact={contact}
            fallbackPhone={contactPhone}
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
      loadingText="Loading contact data..."
      size="lg"
      footerButtons={footerButtons}
      footerAlignment="right"
      showBackButton={true}
      resizable={true}
      storageKey="contact-drawer-width"
      onClose={handleClose}
    >
      {drawerContent}
    </SideDrawer>
  );
}
