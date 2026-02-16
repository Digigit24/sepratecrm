// src/components/contact-drawer/ContactBasicInfo.tsx
import { forwardRef, useEffect, useImperativeHandle, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X } from 'lucide-react';
import { useUsers } from '@/hooks/useUsers';

import type { Contact, CreateContactPayload } from '@/types/whatsappTypes';
import type { ContactBasicInfoHandle } from '../ContactsFormDrawer';

// Validation schema
const contactSchema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
  name: z.string().optional(),
  status: z.string().optional(),
  assigned_to: z.string().optional(),
  profile_pic_url: z.string().optional(),
  notes: z.string().optional(),
  labels: z.array(z.string()).optional(),
  groups: z.array(z.string()).optional(),
  is_business: z.boolean().optional(),
  business_description: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactBasicInfoProps {
  contact?: Contact | null;
  fallbackPhone?: string | null;
  mode: 'view' | 'edit' | 'create';
  onSuccess?: () => void;
}

const ContactBasicInfo = forwardRef<ContactBasicInfoHandle, ContactBasicInfoProps>(
  ({ contact, fallbackPhone, mode }, ref) => {
    const isReadOnly = mode === 'view';
    const { useUsersList } = useUsers();
    const { data: usersData, isLoading: usersLoading } = useUsersList({
      page: 1,
      page_size: 1000,
      is_active: true,
    });

    const normalizedDefaults = useMemo(
      () => ({
        phone: contact?.phone || fallbackPhone || '',
        name: contact?.name || '',
        status: contact?.status || '',
        assigned_to: contact?.assigned_to ? String(contact.assigned_to) : '',
        profile_pic_url: contact?.profile_pic_url || '',
        notes: contact?.notes || '',
        labels: contact?.labels || [],
        groups: contact?.groups || [],
        is_business: contact?.is_business ?? false,
        business_description: contact?.business_description || '',
      }),
      [contact, fallbackPhone]
    );

    const {
      register,
      control,
      handleSubmit,
      formState: { errors },
      watch,
      setValue,
      reset,
    } = useForm<ContactFormData>({
      resolver: zodResolver(contactSchema),
      defaultValues: normalizedDefaults,
    });

    const watchedLabels = watch('labels') || [];
    const watchedGroups = watch('groups') || [];
    const watchedIsBusiness = watch('is_business');

    useEffect(() => {
      reset(normalizedDefaults);
    }, [normalizedDefaults, mode, reset]);

    const assignedUserDisplayName = useMemo(() => {
      if (!contact?.assigned_to) return null;
      const match = usersData?.results?.find((user) => user.id === contact.assigned_to);
      if (match) {
        const fullName = `${match.first_name || ''} ${match.last_name || ''}`.trim();
        return fullName || match.email || match.id;
      }
      return contact.assigned_to;
    }, [contact?.assigned_to, usersData]);

    // Expose form validation and data collection to parent
    useImperativeHandle(ref, () => ({
      getFormValues: async (): Promise<CreateContactPayload | null> => {
        return new Promise((resolve) => {
          handleSubmit(
            (data) => {
              const payload: CreateContactPayload = {
                phone: data.phone,
                name: data.name || undefined,
                status: data.status || undefined,
                assigned_to: data.assigned_to ? data.assigned_to : null,
                profile_pic_url: data.profile_pic_url || undefined,
                notes: data.notes || undefined,
                labels: data.labels?.length ? data.labels : undefined,
                groups: data.groups?.length ? data.groups : undefined,
                is_business: data.is_business || false,
                business_description: data.business_description || undefined,
              };
              resolve(payload);
            },
            () => resolve(null)
          )();
        });
      },
    }));

    const addLabel = (label: string) => {
      if (label.trim() && !watchedLabels.includes(label.trim())) {
        setValue('labels', [...watchedLabels, label.trim()]);
      }
    };

    const removeLabel = (labelToRemove: string) => {
      setValue('labels', watchedLabels.filter(label => label !== labelToRemove));
    };

    const addGroup = (group: string) => {
      if (group.trim() && !watchedGroups.includes(group.trim())) {
        setValue('groups', [...watchedGroups, group.trim()]);
      }
    };

    const removeGroup = (groupToRemove: string) => {
      setValue('groups', watchedGroups.filter(group => group !== groupToRemove));
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>, type: 'label' | 'group') => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const value = e.currentTarget.value;
        if (type === 'label') {
          addLabel(value);
        } else {
          addGroup(value);
        }
        e.currentTarget.value = '';
      }
    };

    return (
      <div className="space-y-5">
        {/* Basic Information */}
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
            Basic Information
          </h3>
          <div className="divide-y divide-border/40">
            {/* Phone */}
            <div className="grid grid-cols-[110px_1fr] items-start gap-3 py-2.5">
              <Label htmlFor="phone" className="text-[13px] text-muted-foreground font-normal pt-2">Phone *</Label>
              <div>
                <Input id="phone" {...register('phone')} placeholder="Enter phone number" disabled={isReadOnly || mode === 'edit'} className={`h-9 ${errors.phone ? 'border-destructive' : ''}`} />
                {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone.message}</p>}
              </div>
            </div>

            {/* Name */}
            <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2.5">
              <Label htmlFor="name" className="text-[13px] text-muted-foreground font-normal">Name</Label>
              <Input id="name" {...register('name')} placeholder="Enter contact name" disabled={isReadOnly} className="h-9" />
            </div>

            {/* Status */}
            <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2.5">
              <Label htmlFor="status" className="text-[13px] text-muted-foreground font-normal">Status</Label>
              <Input id="status" {...register('status')} placeholder="e.g. active, blocked" disabled={isReadOnly} className="h-9" />
            </div>

            {/* Assigned To */}
            <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2.5">
              <Label htmlFor="assigned_to" className="text-[13px] text-muted-foreground font-normal">Assigned To</Label>
              <Controller name="assigned_to" control={control} render={({ field }) => (
                <Select value={field.value || 'unassigned'} onValueChange={(value) => field.onChange(value === 'unassigned' ? '' : value)} disabled={isReadOnly || usersLoading}>
                  <SelectTrigger id="assigned_to" className="h-9"><SelectValue placeholder={usersLoading ? 'Loading...' : 'Select user'} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {usersData?.results?.map((user) => {
                      const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || user.id;
                      return (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center gap-2">
                            <span>{displayName}</span>
                            {user.email && <span className="text-xs text-muted-foreground">({user.email})</span>}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )} />
            </div>

            {/* Profile Picture URL */}
            <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2.5">
              <Label htmlFor="profile_pic_url" className="text-[13px] text-muted-foreground font-normal">Avatar URL</Label>
              <Input id="profile_pic_url" {...register('profile_pic_url')} placeholder="https://example.com/avatar.jpg" disabled={isReadOnly} className="h-9" />
            </div>

            {/* Business Contact Toggle */}
            <div className="flex items-center justify-between py-2.5">
              <Label htmlFor="is_business" className="text-[13px] text-muted-foreground font-normal">Business Contact</Label>
              <Switch id="is_business" checked={watchedIsBusiness} onCheckedChange={(checked) => setValue('is_business', checked)} disabled={isReadOnly} />
            </div>

            {/* Business Description (conditional) */}
            {watchedIsBusiness && (
              <div className="py-2.5 space-y-1.5">
                <Label htmlFor="business_description" className="text-[13px] text-muted-foreground font-normal">Business Description</Label>
                <Textarea id="business_description" {...register('business_description')} placeholder="Describe the business" disabled={isReadOnly} rows={3} />
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border/50" />

        {/* Labels */}
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
            Labels
          </h3>
          {watchedLabels.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {watchedLabels.map((label) => (
                <Badge key={label} variant="secondary" className="flex items-center gap-1">
                  {label}
                  {!isReadOnly && (
                    <Button type="button" variant="ghost" size="sm" className="h-4 w-4 p-0 hover:bg-transparent" onClick={() => removeLabel(label)}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </Badge>
              ))}
            </div>
          )}
          {!isReadOnly && (
            <Input placeholder="Type label and press Enter" onKeyPress={(e) => handleKeyPress(e, 'label')} className="h-9" />
          )}
          {watchedLabels.length === 0 && isReadOnly && (
            <p className="text-sm text-muted-foreground">No labels</p>
          )}
        </div>

        <div className="border-t border-border/50" />

        {/* Groups */}
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
            Groups
          </h3>
          {watchedGroups.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {watchedGroups.map((group) => (
                <Badge key={group} variant="outline" className="flex items-center gap-1">
                  {group}
                  {!isReadOnly && (
                    <Button type="button" variant="ghost" size="sm" className="h-4 w-4 p-0 hover:bg-transparent" onClick={() => removeGroup(group)}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </Badge>
              ))}
            </div>
          )}
          {!isReadOnly && (
            <Input placeholder="Type group and press Enter" onKeyPress={(e) => handleKeyPress(e, 'group')} className="h-9" />
          )}
          {watchedGroups.length === 0 && isReadOnly && (
            <p className="text-sm text-muted-foreground">No groups</p>
          )}
        </div>

        <div className="border-t border-border/50" />

        {/* Notes */}
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
            Notes
          </h3>
          {isReadOnly ? (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contact?.notes || 'No notes'}</p>
          ) : (
            <Textarea {...register('notes')} placeholder="Add notes about this contact" rows={4} />
          )}
        </div>

        {/* Contact Metadata (View Mode Only) */}
        {mode === 'view' && contact && (
          <>
            <div className="border-t border-border/50" />
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
                Contact Information
              </h3>
              <div className="divide-y divide-border/40">
                <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2">
                  <span className="text-[13px] text-muted-foreground">Contact ID</span>
                  <span className="text-sm font-mono">{contact.id}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2">
                  <span className="text-[13px] text-muted-foreground">Status</span>
                  <span className="text-sm">{contact.status || 'No status'}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2">
                  <span className="text-[13px] text-muted-foreground">Assigned To</span>
                  <span className="text-sm">{assignedUserDisplayName || contact.assigned_to || 'Unassigned'}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2">
                  <span className="text-[13px] text-muted-foreground">Last Seen</span>
                  <span className="text-sm">{contact.last_seen ? new Date(contact.last_seen).toLocaleString() : 'Never'}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2">
                  <span className="text-[13px] text-muted-foreground">Created</span>
                  <span className="text-sm">{new Date(contact.created_at).toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2">
                  <span className="text-[13px] text-muted-foreground">Updated</span>
                  <span className="text-sm">{contact.updated_at ? new Date(contact.updated_at).toLocaleString() : 'N/A'}</span>
                </div>
                {contact.profile_pic_url && (
                  <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2">
                    <span className="text-[13px] text-muted-foreground">Avatar</span>
                    <img src={contact.profile_pic_url} alt="Profile" className="w-10 h-10 rounded-full object-cover" />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }
);

ContactBasicInfo.displayName = 'ContactBasicInfo';

export default ContactBasicInfo;
