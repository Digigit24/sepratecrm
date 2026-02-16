// src/components/lead-drawer/LeadBasicInfo.tsx
import { forwardRef, useImperativeHandle, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

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
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { Lead, CreateLeadPayload, PriorityEnum } from '@/types/crmTypes';
import type { LeadFormHandle } from '../LeadsFormDrawer';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { useUsers } from '@/hooks/useUsers';
import { useCurrency } from '@/hooks/useCurrency';
import { PRIORITY_OPTIONS } from '@/types/crmTypes';

const leadBasicSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
  phone: z.string().min(1, 'Phone is required').max(20, 'Phone is too long'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  company: z.string().max(255, 'Company name is too long').optional(),
  title: z.string().max(255, 'Title is too long').optional(),
  status: z.number().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  value_amount: z.string().optional(),
  value_currency: z.string().max(3, 'Currency code too long').optional(),
  source: z.string().max(100, 'Source is too long').optional(),
  owner_user_id: z.string().optional(),
  assigned_to: z.string().optional(),
  last_contacted_at: z.string().optional(),
  next_follow_up_at: z.string().optional(),
  notes: z.string().optional(),
});

type LeadBasicFormData = z.infer<typeof leadBasicSchema>;

interface LeadBasicInfoProps {
  lead?: Lead | null;
  mode: 'view' | 'edit' | 'create';
  onSuccess?: () => void;
}

const LeadBasicInfo = forwardRef<LeadFormHandle, LeadBasicInfoProps>(
  ({ lead, mode, onSuccess }, ref) => {
    const { user } = useAuth();
    const { useLeadStatuses } = useCRM();
    const { useUsersList } = useUsers();
    const { getCurrencyCode } = useCurrency();

    // Fetch lead statuses
    const { data: statusesData, isLoading: statusesLoading } = useLeadStatuses({
      is_active: true,
      ordering: 'order_index',
    });

    // Fetch users for assigned_to dropdown
    const { data: usersData, isLoading: usersLoading } = useUsersList({
      page: 1,
      page_size: 1000,
      is_active: true,
    });

    const isReadOnly = mode === 'view';

    const {
      control,
      handleSubmit,
      reset,
      formState: { errors },
    } = useForm<LeadBasicFormData>({
      resolver: zodResolver(leadBasicSchema),
      defaultValues: {
        name: '',
        phone: '',
        email: '',
        company: '',
        title: '',
        priority: 'MEDIUM',
        value_amount: '',
        value_currency: getCurrencyCode(),
        source: '',
        owner_user_id: user?.id || '',
        assigned_to: '',
        notes: '',
      },
    });

    // Update form when lead data changes
    useEffect(() => {
      if (lead) {
        reset({
          name: lead.name || '',
          phone: lead.phone || '',
          email: lead.email || '',
          company: lead.company || '',
          title: lead.title || '',
          status: typeof lead.status === 'object' ? lead.status?.id : lead.status,
          priority: lead.priority || 'MEDIUM',
          value_amount: lead.value_amount || '',
          value_currency: lead.value_currency || getCurrencyCode(),
          source: lead.source || '',
          owner_user_id: lead.owner_user_id || user?.id || '',
          assigned_to: lead.assigned_to || '',
          last_contacted_at: lead.last_contacted_at || '',
          next_follow_up_at: lead.next_follow_up_at || '',
          notes: lead.notes || '',
        });
      } else if (mode === 'create') {
        reset({
          name: '',
          phone: '',
          email: '',
          company: '',
          title: '',
          priority: 'MEDIUM',
          value_amount: '',
          value_currency: getCurrencyCode(),
          source: '',
          owner_user_id: user?.id || '',
          assigned_to: '',
          notes: '',
        });
      }
    }, [lead, mode, reset, user?.id]);

    // Expose getFormValues to parent
    useImperativeHandle(ref, () => ({
      getFormValues: async (): Promise<CreateLeadPayload | null> => {
        return new Promise((resolve) => {
          handleSubmit(
            (data) => {
              // Clean up empty strings to undefined
              const cleanData: CreateLeadPayload = {
                name: data.name,
                phone: data.phone,
                email: data.email || undefined,
                company: data.company || undefined,
                title: data.title || undefined,
                status: data.status,
                priority: data.priority as PriorityEnum,
                value_amount: data.value_amount || undefined,
                value_currency: data.value_currency || undefined,
                source: data.source || undefined,
                owner_user_id: data.owner_user_id || undefined,
                assigned_to: data.assigned_to || undefined,
                last_contacted_at: data.last_contacted_at || undefined,
                next_follow_up_at: data.next_follow_up_at || undefined,
                notes: data.notes || undefined,
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
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name" className={errors.name ? 'text-destructive' : ''}>
            Name <span className="text-destructive">*</span>
          </Label>
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="name"
                placeholder="John Doe"
                disabled={isReadOnly}
                className={errors.name ? 'border-destructive' : ''}
              />
            )}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone" className={errors.phone ? 'text-destructive' : ''}>
            Phone <span className="text-destructive">*</span>
          </Label>
          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                disabled={isReadOnly}
                className={errors.phone ? 'border-destructive' : ''}
              />
            )}
          />
          {errors.phone && (
            <p className="text-sm text-destructive">{errors.phone.message}</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email" className={errors.email ? 'text-destructive' : ''}>
            Email
          </Label>
          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="email"
                type="email"
                placeholder="john@example.com"
                disabled={isReadOnly}
                className={errors.email ? 'border-destructive' : ''}
              />
            )}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Company */}
        <div className="space-y-2">
          <Label htmlFor="company">Company</Label>
          <Controller
            name="company"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="company"
                placeholder="Acme Inc."
                disabled={isReadOnly}
              />
            )}
          />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Controller
            name="title"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="title"
                placeholder="CEO"
                disabled={isReadOnly}
              />
            )}
          />
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value?.toString()}
                onValueChange={(value) => field.onChange(parseInt(value, 10))}
                disabled={isReadOnly || statusesLoading}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusesData?.results.map((status) => (
                    <SelectItem key={status.id} value={status.id.toString()}>
                      <div className="flex items-center gap-2">
                        {status.color_hex && (
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: status.color_hex }}
                          />
                        )}
                        {status.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Priority */}
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Controller
            name="priority"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isReadOnly}
              >
                <SelectTrigger id="priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Value Amount & Currency */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="value_amount">Deal Value</Label>
            <Controller
              name="value_amount"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  id="value_amount"
                  type="number"
                  step="0.01"
                  placeholder="10000.00"
                  disabled={isReadOnly}
                />
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="value_currency">Currency</Label>
            <Controller
              name="value_currency"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  id="value_currency"
                  placeholder="USD"
                  maxLength={3}
                  disabled={isReadOnly}
                />
              )}
            />
          </div>
        </div>

        {/* Source */}
        <div className="space-y-2">
          <Label htmlFor="source">Source</Label>
          <Controller
            name="source"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="source"
                placeholder="Website, Referral, Trade Show, etc."
                disabled={isReadOnly}
              />
            )}
          />
        </div>

        {/* Assigned To */}
        <div className="space-y-2">
          <Label htmlFor="assigned_to">Assigned To</Label>
          <Controller
            name="assigned_to"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value || 'unassigned'}
                onValueChange={(value) => field.onChange(value === 'unassigned' ? '' : value)}
                disabled={isReadOnly || usersLoading}
              >
                <SelectTrigger id="assigned_to">
                  <SelectValue placeholder={usersLoading ? 'Loading users...' : 'Select user'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">No assignment</SelectItem>
                  {usersData?.results?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <span>{user.first_name} {user.last_name}</span>
                        <span className="text-xs text-muted-foreground">({user.email})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Last Contacted */}
        <div className="space-y-2">
          <Label htmlFor="last_contacted_at">Last Contacted</Label>
          <Controller
            name="last_contacted_at"
            control={control}
            render={({ field }) => (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !field.value && 'text-muted-foreground'
                    )}
                    disabled={isReadOnly}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {field.value
                      ? format(new Date(field.value), 'PPP')
                      : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value ? new Date(field.value) : undefined}
                    onSelect={(date) =>
                      field.onChange(date ? date.toISOString() : '')
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            )}
          />
        </div>

        {/* Next Follow-up */}
        <div className="space-y-2">
          <Label htmlFor="next_follow_up_at">Next Follow-up</Label>
          <Controller
            name="next_follow_up_at"
            control={control}
            render={({ field }) => (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !field.value && 'text-muted-foreground'
                    )}
                    disabled={isReadOnly}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {field.value
                      ? format(new Date(field.value), 'PPP')
                      : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value ? new Date(field.value) : undefined}
                    onSelect={(date) =>
                      field.onChange(date ? date.toISOString() : '')
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            )}
          />
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <Textarea
                {...field}
                id="notes"
                placeholder="Add any additional notes about this lead..."
                rows={4}
                disabled={isReadOnly}
              />
            )}
          />
        </div>
      </div>
    );
  }
);

LeadBasicInfo.displayName = 'LeadBasicInfo';

export default LeadBasicInfo;