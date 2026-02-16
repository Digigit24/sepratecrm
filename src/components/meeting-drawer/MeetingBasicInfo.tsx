// src/components/meeting-drawer/MeetingBasicInfo.tsx
import { forwardRef, useImperativeHandle, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import useSWR from 'swr';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { Meeting, MeetingCreateData, MeetingUpdateData } from '@/types/meeting.types';
import type { Lead } from '@/types/crmTypes';
import { crmClient } from '@/lib/client';
import { API_CONFIG } from '@/lib/apiConfig';
import { format } from 'date-fns';

// Validation schemas
const createMeetingSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  start_at: z.string().min(1, 'Start time is required'),
  end_at: z.string().min(1, 'End time is required'),
  lead: z.coerce.number().nullable().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  if (data.start_at && data.end_at) {
    return new Date(data.end_at) > new Date(data.start_at);
  }
  return true;
}, {
  message: 'End time must be after start time',
  path: ['end_at'],
});

const updateMeetingSchema = z.object({
  title: z.string().optional(),
  start_at: z.string().optional(),
  end_at: z.string().optional(),
  lead: z.coerce.number().nullable().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  if (data.start_at && data.end_at) {
    return new Date(data.end_at) > new Date(data.start_at);
  }
  return true;
}, {
  message: 'End time must be after start time',
  path: ['end_at'],
});

type MeetingFormData = z.infer<typeof createMeetingSchema> | z.infer<typeof updateMeetingSchema>;

export interface MeetingBasicInfoHandle {
  getFormValues: () => Promise<MeetingCreateData | MeetingUpdateData | null>;
}

interface MeetingBasicInfoProps {
  meeting?: Meeting | null;
  mode: 'view' | 'edit' | 'create';
  onSuccess?: () => void;
  initialLeadId?: number | null;
}

/**
 * Convert ISO datetime string to datetime-local input format (YYYY-MM-DDThh:mm)
 */
const toDateTimeLocal = (isoString: string): string => {
  if (!isoString) return '';
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Convert datetime-local input format to ISO datetime string
 */
const toISOString = (dateTimeLocal: string): string => {
  if (!dateTimeLocal) return '';
  return new Date(dateTimeLocal).toISOString();
};

const MeetingBasicInfo = forwardRef<MeetingBasicInfoHandle, MeetingBasicInfoProps>(
  ({ meeting, mode, onSuccess, initialLeadId }, ref) => {
    const isReadOnly = mode === 'view';
    const isCreateMode = mode === 'create';

    // Fetch leads for select dropdown
    const { data: leadsData } = useSWR<{ results: Lead[] }>(
      'leads-for-meetings',
      async () => {
        const response = await crmClient.get(`${API_CONFIG.CRM.LEADS}?page_size=100`);
        return response.data;
      },
      { revalidateOnFocus: false }
    );

    const leads = leadsData?.results || [];

    const schema = isCreateMode ? createMeetingSchema : updateMeetingSchema;

    // Get default start/end times (now and 1 hour from now)
    const getDefaultStartTime = () => {
      const now = new Date();
      now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15); // Round to next 15 minutes
      return toDateTimeLocal(now.toISOString());
    };

    const getDefaultEndTime = () => {
      const oneHourLater = new Date();
      oneHourLater.setHours(oneHourLater.getHours() + 1);
      oneHourLater.setMinutes(Math.ceil(oneHourLater.getMinutes() / 15) * 15);
      return toDateTimeLocal(oneHourLater.toISOString());
    };

    const defaultValues = isCreateMode
      ? {
          title: '',
          start_at: getDefaultStartTime(),
          end_at: getDefaultEndTime(),
          lead: initialLeadId || null,
          location: '',
          description: '',
          notes: '',
        }
      : {
          title: meeting?.title || '',
          start_at: meeting?.start_at ? toDateTimeLocal(meeting.start_at) : '',
          end_at: meeting?.end_at ? toDateTimeLocal(meeting.end_at) : '',
          lead: meeting?.lead || null,
          location: meeting?.location || '',
          description: meeting?.description || '',
          notes: meeting?.notes || '',
        };

    const {
      register,
      handleSubmit,
      formState: { errors },
      watch,
      setValue,
      reset,
    } = useForm<any>({
      resolver: zodResolver(schema),
      defaultValues,
    });

    const watchedStartAt = watch('start_at');
    const watchedEndAt = watch('end_at');
    const watchedLead = watch('lead');

    // Reset form when meeting data changes (for edit/view modes)
    useEffect(() => {
      if (!isCreateMode && meeting) {
        const formValues = {
          title: meeting.title || '',
          start_at: meeting.start_at ? toDateTimeLocal(meeting.start_at) : '',
          end_at: meeting.end_at ? toDateTimeLocal(meeting.end_at) : '',
          lead: meeting.lead || null,
          location: meeting.location || '',
          description: meeting.description || '',
          notes: meeting.notes || '',
        };
        reset(formValues);
      }
    }, [meeting, isCreateMode, reset]);

    // Expose form validation and data collection to parent
    useImperativeHandle(ref, () => ({
      getFormValues: async (): Promise<MeetingCreateData | MeetingUpdateData | null> => {
        return new Promise((resolve) => {
          handleSubmit(
            (data) => {
              if (isCreateMode) {
                const payload: MeetingCreateData = {
                  title: data.title,
                  start_at: toISOString(data.start_at),
                  end_at: toISOString(data.end_at),
                  lead: data.lead || null,
                  location: data.location || undefined,
                  description: data.description || undefined,
                  notes: data.notes || undefined,
                };
                resolve(payload);
              } else {
                const payload: MeetingUpdateData = {
                  title: data.title,
                  start_at: toISOString(data.start_at),
                  end_at: toISOString(data.end_at),
                  lead: data.lead || null,
                  location: data.location || undefined,
                  description: data.description || undefined,
                  notes: data.notes || undefined,
                };
                resolve(payload);
              }
            },
            () => resolve(null)
          )();
        });
      },
    }));

    // Format datetime for display in view mode
    const formatDateTime = (isoString: string) => {
      if (!isoString) return 'Not set';
      try {
        return format(new Date(isoString), 'PPp'); // e.g., "Apr 29, 2023, 9:30 AM"
      } catch {
        return isoString;
      }
    };

    return (
      <div className="space-y-6">
        {/* Meeting Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meeting Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-red-500">*</span>
              </Label>
              {isReadOnly ? (
                <p className="text-sm font-medium">{meeting?.title || 'Not set'}</p>
              ) : (
                <>
                  <Input
                    id="title"
                    {...register('title')}
                    placeholder="Enter meeting title"
                    disabled={isReadOnly}
                  />
                  {errors.title && (
                    <p className="text-sm text-red-500">{errors.title.message as string}</p>
                  )}
                </>
              )}
            </div>

            {/* Start Time */}
            <div className="space-y-2">
              <Label htmlFor="start_at">
                Start Time <span className="text-red-500">*</span>
              </Label>
              {isReadOnly ? (
                <p className="text-sm font-medium">{formatDateTime(meeting?.start_at || '')}</p>
              ) : (
                <>
                  <Input
                    id="start_at"
                    type="datetime-local"
                    {...register('start_at')}
                    disabled={isReadOnly}
                  />
                  {errors.start_at && (
                    <p className="text-sm text-red-500">{errors.start_at.message as string}</p>
                  )}
                </>
              )}
            </div>

            {/* End Time */}
            <div className="space-y-2">
              <Label htmlFor="end_at">
                End Time <span className="text-red-500">*</span>
              </Label>
              {isReadOnly ? (
                <p className="text-sm font-medium">{formatDateTime(meeting?.end_at || '')}</p>
              ) : (
                <>
                  <Input
                    id="end_at"
                    type="datetime-local"
                    {...register('end_at')}
                    disabled={isReadOnly}
                  />
                  {errors.end_at && (
                    <p className="text-sm text-red-500">{errors.end_at.message as string}</p>
                  )}
                </>
              )}
            </div>

            {/* Lead Selection */}
            <div className="space-y-2">
              <Label htmlFor="lead">Associated Lead</Label>
              {isReadOnly ? (
                <p className="text-sm font-medium">
                  {meeting?.lead_name || meeting?.lead || 'No lead associated'}
                </p>
              ) : (
                <>
                  <Select
                    value={watchedLead?.toString() || 'none'}
                    onValueChange={(value) => setValue('lead', value === 'none' ? null : Number(value))}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a lead (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No lead</SelectItem>
                      {leads.map((lead) => (
                        <SelectItem key={lead.id} value={lead.id.toString()}>
                          {lead.name} - {lead.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.lead && (
                    <p className="text-sm text-red-500">{errors.lead.message as string}</p>
                  )}
                </>
              )}
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              {isReadOnly ? (
                <p className="text-sm text-muted-foreground">{meeting?.location || 'Not specified'}</p>
              ) : (
                <>
                  <Input
                    id="location"
                    {...register('location')}
                    placeholder="Enter meeting location"
                    disabled={isReadOnly}
                  />
                  {errors.location && (
                    <p className="text-sm text-red-500">{errors.location.message as string}</p>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Description & Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Additional Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              {isReadOnly ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {meeting?.description || 'No description'}
                </p>
              ) : (
                <>
                  <Textarea
                    id="description"
                    {...register('description')}
                    placeholder="Enter meeting description"
                    rows={3}
                    disabled={isReadOnly}
                  />
                  {errors.description && (
                    <p className="text-sm text-red-500">{errors.description.message as string}</p>
                  )}
                </>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              {isReadOnly ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {meeting?.notes || 'No notes'}
                </p>
              ) : (
                <>
                  <Textarea
                    id="notes"
                    {...register('notes')}
                    placeholder="Enter meeting notes"
                    rows={3}
                    disabled={isReadOnly}
                  />
                  {errors.notes && (
                    <p className="text-sm text-red-500">{errors.notes.message as string}</p>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Metadata (View Mode Only) */}
        {mode === 'view' && meeting && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Meeting ID:</span>
                <Badge variant="secondary">{meeting.id}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created At:</span>
                <span>{formatDateTime(meeting.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Updated:</span>
                <span>{formatDateTime(meeting.updated_at)}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }
);

MeetingBasicInfo.displayName = 'MeetingBasicInfo';

export default MeetingBasicInfo;
