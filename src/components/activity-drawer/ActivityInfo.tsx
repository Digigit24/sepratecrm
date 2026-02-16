// src/components/activity-drawer/ActivityInfo-Advanced.tsx
// This version has a SEARCHABLE dropdown for better UX when you have many leads

import { forwardRef, useImperativeHandle, useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, Check, ChevronsUpDown } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { LeadActivity, CreateLeadActivityPayload, ActivityTypeEnum } from '@/types/crmTypes';
import type { ActivityFormHandle } from '../ActivitiesFormDrawer';
import { useAuth } from '@/hooks/useAuth';
import { useCRM } from '@/hooks/useCRM';
import { ACTIVITY_TYPE_OPTIONS } from '@/types/crmTypes';

const activitySchema = z.object({
  lead: z.number().min(1, 'Lead is required'),
  type: z.enum(['CALL', 'EMAIL', 'MEETING', 'NOTE', 'SMS', 'OTHER']),
  content: z.string().optional(),
  happened_at: z.string().min(1, 'Date and time is required'),
  by_user_id: z.string().optional(),
  meta: z.record(z.any()).optional(),
  file_url: z.string().url('Invalid URL').optional().or(z.literal('')),
});

type ActivityFormData = z.infer<typeof activitySchema>;

interface ActivityInfoProps {
  activity?: LeadActivity | null;
  mode: 'view' | 'edit' | 'create';
  onSuccess?: () => void;
}

const ActivityInfo = forwardRef<ActivityFormHandle, ActivityInfoProps>(
  ({ activity, mode, onSuccess }, ref) => {
    const { user } = useAuth();
    const { useLeads } = useCRM();
    const isReadOnly = mode === 'view';
    const [open, setOpen] = useState(false);

    // Fetch all leads for the dropdown
    const { data: leadsData, isLoading: leadsLoading } = useLeads({
      page: 1,
      page_size: 1000,
      ordering: 'name',
    });

    const {
      control,
      handleSubmit,
      reset,
      formState: { errors },
    } = useForm<ActivityFormData>({
      resolver: zodResolver(activitySchema),
      defaultValues: {
        lead: 0,
        type: 'NOTE',
        content: '',
        happened_at: new Date().toISOString(),
        by_user_id: user?.id || '',
        meta: {},
        file_url: '',
      },
    });

    useEffect(() => {
      if (activity) {
        reset({
          lead: activity.lead,
          type: activity.type,
          content: activity.content || '',
          happened_at: activity.happened_at,
          by_user_id: activity.by_user_id || user?.id || '',
          meta: activity.meta || {},
          file_url: activity.file_url || '',
        });
      } else if (mode === 'create') {
        reset({
          lead: 0,
          type: 'NOTE',
          content: '',
          happened_at: new Date().toISOString(),
          by_user_id: user?.id || '',
          meta: {},
          file_url: '',
        });
      }
    }, [activity, mode, reset, user?.id]);

    useImperativeHandle(ref, () => ({
      getFormValues: async (): Promise<CreateLeadActivityPayload | null> => {
        return new Promise((resolve) => {
          handleSubmit(
            (data) => {
              const cleanData: CreateLeadActivityPayload = {
                lead: data.lead,
                type: data.type as ActivityTypeEnum,
                content: data.content || undefined,
                happened_at: data.happened_at,
                by_user_id: data.by_user_id || undefined,
                meta: Object.keys(data.meta || {}).length > 0 ? data.meta : undefined,
                file_url: data.file_url || undefined,
              };
              resolve(cleanData);
            },
            () => {
              resolve(null);
            }
          )();
        });
      },
    }));

    return (
      <div className="space-y-6">
        {/* Lead - SEARCHABLE Dropdown */}
        <div className="space-y-2">
          <Label htmlFor="lead" className={errors.lead ? 'text-destructive' : ''}>
            Lead <span className="text-destructive">*</span>
          </Label>
          <Controller
            name="lead"
            control={control}
            render={({ field }) => (
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                      'w-full justify-between',
                      !field.value && 'text-muted-foreground',
                      errors.lead && 'border-destructive'
                    )}
                    disabled={isReadOnly || leadsLoading}
                  >
                    {field.value && leadsData?.results ? (
                      (() => {
                        const selectedLead = leadsData.results.find(l => l.id === field.value);
                        return selectedLead ? (
                          <div className="flex items-center gap-2 flex-1 text-left truncate">
                            <span className="font-medium">{selectedLead.name}</span>
                            {selectedLead.company && (
                              <>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-muted-foreground text-sm truncate">
                                  {selectedLead.company}
                                </span>
                              </>
                            )}
                          </div>
                        ) : (
                          `Lead #${field.value}`
                        );
                      })()
                    ) : (
                      <span>{leadsLoading ? 'Loading leads...' : 'Select lead...'}</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search leads..." />
                    <CommandEmpty>
                      {leadsLoading ? 'Loading...' : 'No leads found.'}
                    </CommandEmpty>
                    <CommandGroup className="max-h-[300px] overflow-auto">
                      {leadsData?.results.map((lead) => (
                        <CommandItem
                          key={lead.id}
                          value={`${lead.name} ${lead.company || ''} ${lead.phone}`}
                          onSelect={() => {
                            field.onChange(lead.id);
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              field.value === lead.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <div className="flex flex-col flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{lead.name}</span>
                              <span className="text-xs text-muted-foreground">#{lead.id}</span>
                            </div>
                            {lead.company && (
                              <span className="text-xs text-muted-foreground">{lead.company}</span>
                            )}
                            {lead.phone && (
                              <span className="text-xs text-muted-foreground">{lead.phone}</span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          />
          {errors.lead && (
            <p className="text-sm text-destructive">{errors.lead.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Search and select the lead this activity is associated with
          </p>
        </div>

        {/* Activity Type */}
        <div className="space-y-2">
          <Label htmlFor="type" className={errors.type ? 'text-destructive' : ''}>
            Activity Type <span className="text-destructive">*</span>
          </Label>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isReadOnly}
              >
                <SelectTrigger id="type" className={errors.type ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select activity type" />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.type && (
            <p className="text-sm text-destructive">{errors.type.message}</p>
          )}
        </div>

        {/* Date and Time */}
        <div className="space-y-2">
          <Label htmlFor="happened_at" className={errors.happened_at ? 'text-destructive' : ''}>
            Date & Time <span className="text-destructive">*</span>
          </Label>
          <Controller
            name="happened_at"
            control={control}
            render={({ field }) => (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !field.value && 'text-muted-foreground',
                      errors.happened_at && 'border-destructive'
                    )}
                    disabled={isReadOnly}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {field.value
                      ? format(new Date(field.value), 'PPP p')
                      : 'Pick a date and time'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value ? new Date(field.value) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        const existingTime = field.value
                          ? new Date(field.value)
                          : new Date();
                        date.setHours(existingTime.getHours());
                        date.setMinutes(existingTime.getMinutes());
                        field.onChange(date.toISOString());
                      }
                    }}
                    initialFocus
                  />
                  <div className="p-3 border-t">
                    <Input
                      type="time"
                      value={
                        field.value
                          ? format(new Date(field.value), 'HH:mm')
                          : ''
                      }
                      onChange={(e) => {
                        const [hours, minutes] = e.target.value.split(':');
                        const date = field.value
                          ? new Date(field.value)
                          : new Date();
                        date.setHours(parseInt(hours, 10));
                        date.setMinutes(parseInt(minutes, 10));
                        field.onChange(date.toISOString());
                      }}
                      disabled={isReadOnly}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            )}
          />
          {errors.happened_at && (
            <p className="text-sm text-destructive">{errors.happened_at.message}</p>
          )}
        </div>

        {/* Content */}
        <div className="space-y-2">
          <Label htmlFor="content">Content / Notes</Label>
          <Controller
            name="content"
            control={control}
            render={({ field }) => (
              <Textarea
                {...field}
                id="content"
                placeholder="Add details about this activity..."
                rows={6}
                disabled={isReadOnly}
              />
            )}
          />
          <p className="text-xs text-muted-foreground">
            Describe what happened during this interaction
          </p>
        </div>

        {/* File URL */}
        <div className="space-y-2">
          <Label htmlFor="file_url" className={errors.file_url ? 'text-destructive' : ''}>
            File / Attachment URL
          </Label>
          <Controller
            name="file_url"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="file_url"
                type="url"
                placeholder="https://example.com/file.pdf"
                disabled={isReadOnly}
                className={errors.file_url ? 'border-destructive' : ''}
              />
            )}
          />
          {errors.file_url && (
            <p className="text-sm text-destructive">{errors.file_url.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            URL to any related file or attachment
          </p>
        </div>

        {/* View Mode: Display metadata */}
        {mode === 'view' && activity && (
          <div className="space-y-2 pt-4 border-t">
            <div className="text-xs text-muted-foreground">
              <div className="flex justify-between py-1">
                <span>Created:</span>
                <span>{format(new Date(activity.created_at), 'PPP p')}</span>
              </div>
              {activity.by_user_id && (
                <div className="flex justify-between py-1">
                  <span>Created By:</span>
                  <span className="font-mono">{activity.by_user_id}</span>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span>Tenant ID:</span>
                <span className="font-mono">{activity.tenant_id}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

ActivityInfo.displayName = 'ActivityInfo';

export default ActivityInfo;